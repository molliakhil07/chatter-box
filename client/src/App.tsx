import { useEffect, useState } from "react";
import { checkServerHealth } from "./services/api";

function App() {
  const [message, setMessage] = useState("Connecting to server...");

  useEffect(() => {
    checkServerHealth()
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("Unable to connect to server");
      });
  }, []);

  return (
    <div>
      <h1>Chatter Box</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;