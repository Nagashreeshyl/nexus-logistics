import { useState } from "react";
import { Console } from "./pages/Console";
import { Intro } from "./pages/Intro";

export function App() {
  const [entered, setEntered] = useState(false);
  if (!entered) return <Intro onEnter={() => setEntered(true)} />;
  return <Console onBack={() => setEntered(false)} />;
}
