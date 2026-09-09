from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from .distance import haversine_km
from .models import Order, Solution, StopRisk, Vehicle

HISTORY_PATH = Path(__file__).resolve().parents[1] / "data" / "history.csv"
MODEL_DIR = Path(__file__).resolve().parents[1] / "data" / "models"
MODEL_PATH = MODEL_DIR / "late_risk.joblib"
META_PATH = MODEL_DIR / "late_risk_meta.json"
ARTIFACT_VERSION = 2

# Post-route overlay features (after a plan exists). Excludes eta_slack.
FEATURES = [
    "depot_km",
    "window_width",
    "load_pct",
    "seq_index",
    "demand",
    "zone_late_rate",
]

# Pre-route triage only — no planned sequence, load, or ETA.
PRE_ROUTE_FEATURES = [
    "depot_km",
    "window_width",
    "demand",
    "zone_late_rate",
]

DATA_DISCLOSURE = (
    "Historical delivery records used for model development are synthetic demonstration data, "
    "not real operational telemetry."
)


def _fit_clf(x_train: pd.DataFrame, y_train: pd.Series) -> tuple[Any, str]:
    try:
        clf: Any = GradientBoostingClassifier(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.08,
            random_state=19,
        )
        clf.fit(x_train, y_train)
        return clf, "GradientBoostingClassifier"
    except Exception:
        clf = LogisticRegression(max_iter=400, random_state=19)
        clf.fit(x_train, y_train)
        return clf, "LogisticRegression"


def _holdout_metrics(clf: Any, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, Any]:
    proba = clf.predict_proba(x_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "accuracy": round(float(accuracy_score(y_test, pred)), 4),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
    }


def train_and_evaluate(persist: bool = True) -> dict[str, Any]:
    df = pd.read_csv(HISTORY_PATH)
    train_df, test_df = train_test_split(df, test_size=0.25, random_state=19, stratify=df["was_late"])
    zone_rates = train_df.groupby("zone")["was_late"].mean().to_dict()

    def enrich(frame: pd.DataFrame) -> pd.DataFrame:
        out = frame.copy()
        out["zone_late_rate"] = out["zone"].map(zone_rates).fillna(0.28)
        return out

    train_df = enrich(train_df)
    test_df = enrich(test_df)

    clf, model_name = _fit_clf(train_df[FEATURES], train_df["was_late"])
    pre_clf, pre_name = _fit_clf(train_df[PRE_ROUTE_FEATURES], train_df["was_late"])

    post_metrics = _holdout_metrics(clf, test_df[FEATURES], test_df["was_late"])
    pre_metrics = _holdout_metrics(pre_clf, test_df[PRE_ROUTE_FEATURES], test_df["was_late"])

    meta: dict[str, Any] = {
        "artifact_version": ARTIFACT_VERSION,
        "model_name": model_name,
        "pre_route_model_name": pre_name,
        "features": FEATURES,
        "pre_route_features": PRE_ROUTE_FEATURES,
        "excluded_features": ["eta_slack"],
        "exclusion_note": (
            "eta_slack depends on a planned ETA after routing; excluded from all models. "
            "Post-route overlay may use load_pct/seq_index from the planned route. "
            "Pre-route triage uses a separate model with PRE_ROUTE_FEATURES only — no placeholders."
        ),
        "data_disclosure": DATA_DISCLOSURE,
        "train_size": int(len(train_df)),
        "test_size": int(len(test_df)),
        "random_state": 19,
        "metrics": post_metrics,
        "pre_route_metrics": pre_metrics,
        "zone_rates": {k: round(float(v), 4) for k, v in zone_rates.items()},
        "not_production_validated": True,
    }
    if persist:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "version": ARTIFACT_VERSION,
                "clf": clf,
                "pre_clf": pre_clf,
                "zone_rates": zone_rates,
                "features": FEATURES,
                "pre_route_features": PRE_ROUTE_FEATURES,
            },
            MODEL_PATH,
        )
        META_PATH.write_text(json.dumps(meta, indent=2))
    return meta


class RiskModel:
    def __init__(self) -> None:
        self.clf: Any | None = None
        self.pre_clf: Any | None = None
        self.zone_rates: dict[str, float] = {}
        self.features = FEATURES
        self.pre_route_features = PRE_ROUTE_FEATURES
        self.meta: dict[str, Any] = {}
        self._load_or_train()

    def _apply_blob(self, blob: dict[str, Any]) -> None:
        self.clf = blob["clf"]
        self.pre_clf = blob.get("pre_clf")
        self.zone_rates = blob["zone_rates"]
        self.features = blob.get("features", FEATURES)
        self.pre_route_features = blob.get("pre_route_features", PRE_ROUTE_FEATURES)

    def _load_or_train(self) -> None:
        if MODEL_PATH.exists() and META_PATH.exists():
            try:
                blob = joblib.load(MODEL_PATH)
                meta = json.loads(META_PATH.read_text())
                if blob.get("version") == ARTIFACT_VERSION and blob.get("pre_clf") is not None:
                    self._apply_blob(blob)
                    self.meta = meta
                    return
            except Exception:
                # Pickle/sklearn version skew — retrain rather than crash startup.
                pass
        # Serverless: package tree may be read-only — train into /tmp when needed.
        try:
            self.meta = train_and_evaluate(persist=True)
            self._apply_blob(joblib.load(MODEL_PATH))
        except OSError:
            import os

            tmp_dir = Path(os.environ.get("NEXUS_DATA_DIR", "/tmp/nexus-data")) / "models"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp_model = tmp_dir / "late_risk.joblib"
            # train_and_evaluate always writes MODEL_PATH; do a local in-memory fit instead.
            self.meta = train_and_evaluate(persist=False)
            df = pd.read_csv(HISTORY_PATH)
            train_df, _ = train_test_split(
                df, test_size=0.25, random_state=19, stratify=df["was_late"]
            )
            zone_rates = train_df.groupby("zone")["was_late"].mean().to_dict()
            train_df = train_df.copy()
            train_df["zone_late_rate"] = train_df["zone"].map(zone_rates).fillna(0.28)
            clf, _ = _fit_clf(train_df[FEATURES], train_df["was_late"])
            pre_clf, _ = _fit_clf(train_df[PRE_ROUTE_FEATURES], train_df["was_late"])
            blob = {
                "version": ARTIFACT_VERSION,
                "clf": clf,
                "pre_clf": pre_clf,
                "zone_rates": zone_rates,
                "features": FEATURES,
                "pre_route_features": PRE_ROUTE_FEATURES,
            }
            try:
                joblib.dump(blob, tmp_model)
            except OSError:
                pass
            self._apply_blob(blob)

    def evaluation(self) -> dict[str, Any]:
        return {
            "data_disclosure": DATA_DISCLOSURE,
            **self.meta,
        }

    def pre_route_score(self, order: Order, depot: tuple[float, float]) -> float:
        """Triage before routing — dedicated pre-route model, no fake route features."""
        depot_km = haversine_km(depot[0], depot[1], order.lat, order.lon)
        window = max(1, order.tw_end - order.tw_start)
        zone_rate = float(self.zone_rates.get(order.zone, 0.28))
        row = pd.DataFrame(
            [
                {
                    "depot_km": depot_km,
                    "window_width": window,
                    "demand": order.demand,
                    "zone_late_rate": zone_rate,
                }
            ]
        )
        if self.pre_clf is None:
            return 0.35
        return float(self.pre_clf.predict_proba(row[self.pre_route_features])[0][1])

    def triage_map(self, orders: list[Order], vehicles: list[Vehicle]) -> dict[str, float]:
        depot = (vehicles[0].depot_lat, vehicles[0].depot_lon)
        return {o.order_id: round(self.pre_route_score(o, depot), 3) for o in orders}

    def attach(self, solution: Solution, orders: list[Order], vehicles: list[Vehicle]) -> Solution:
        by_id = {o.order_id: o for o in orders}
        depot = (vehicles[0].depot_lat, vehicles[0].depot_lon)
        for route in solution.routes:
            load_pct = route.load / max(route.capacity, 1)
            n_stops = max(len(route.stops), 1)
            for stop in route.stops:
                order = by_id[stop.order_id]
                stop.risk = self.score(order, stop.seq, n_stops, load_pct, stop.eta_min, depot)
        if solution.unassigned:
            scores = self.triage_map(orders, vehicles)
            solution.unassigned.sort(
                key=lambda u: (
                    0 if u.priority == "critical" else 1,
                    -scores.get(u.order_id, 0.0),
                    u.tw_end,
                    u.order_id,
                )
            )
        return solution

    def score(
        self,
        order: Order,
        seq: int,
        n_stops: int,
        load_pct: float,
        eta: int,
        depot: tuple[float, float],
    ) -> StopRisk:
        depot_km = haversine_km(depot[0], depot[1], order.lat, order.lon)
        window = max(1, order.tw_end - order.tw_start)
        slack = order.tw_end - eta  # explanation only — not a model feature
        zone_rate = float(self.zone_rates.get(order.zone, 0.28))
        row = pd.DataFrame(
            [
                {
                    "depot_km": depot_km,
                    "window_width": window,
                    "load_pct": load_pct,
                    "seq_index": seq,
                    "demand": order.demand,
                    "zone_late_rate": zone_rate,
                }
            ]
        )
        p = 0.35
        if self.clf is not None:
            p = float(self.clf.predict_proba(row[self.features])[0][1])
        reasons: list[str] = []
        if window <= 45:
            reasons.append(f"tight {window}-min window")
        if zone_rate >= 0.30:
            reasons.append(f"zone historical lateness {int(round(zone_rate * 100))}%")
        if seq >= max(3, n_stops - 1) and n_stops >= 3:
            reasons.append("late in sequence")
        if slack < 12:
            reasons.append("thin ETA slack vs window (plan context)")
        if load_pct >= 0.85:
            reasons.append("vehicle near capacity")
        if depot_km >= 8:
            reasons.append("far from depot")
        if not reasons:
            if p < 0.35:
                reasons.append("adequate operational slack signals")
            else:
                reasons.append("mixed historical delay signals")
        triage = "intervene" if p >= 0.55 else "monitor"
        return StopRisk(p_late=round(min(max(p, 0.0), 1.0), 3), reasons=reasons[:3], triage=triage)
