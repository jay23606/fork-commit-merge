import { createSignal } from "solid-js";
import styles from "./App.module.css";

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <div class={styles.counterContainer}>
      <div class={styles.countNumber}>{count()}</div>
      <div class={styles.countButtonsContainer}>
        <button class={styles.countButtons} onClick={() => setCount(count() - 1)}>
          -
        </button>
        <button class={styles.countButtons} onClick={() => setCount(count() + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export default App;
