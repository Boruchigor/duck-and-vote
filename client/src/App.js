import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import JoinSession from "./pages/JoinSession";
import Vote from "./pages/Vote";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vote/:sessionId" element={<JoinSession />} />
        <Route path="/vote/:sessionId/vote" element={<Vote />} />
      </Routes>
    </Router>
  );
}

export default App;
