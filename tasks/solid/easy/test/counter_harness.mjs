// Behavioural harness for tasks/solid/easy/src/App.jsx.
// Usage (from the repository root): bun tasks/solid/easy/test/counter_harness.mjs tasks/solid/easy/src/App.jsx
// Solid-js is not installed in this clone, so solid-js and CSS modules are
// replaced by small stubs. The JSX is compiled by Bun into h(...) calls.
// This checks the component's logic against the stub only; it does not run
// Solid's real signal or DOM behaviour.
import { plugin } from "bun";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const appPath = resolve(process.argv[2]);

// ---- stub runtime -------------------------------------------------------
const store = [];
let cursor = 0;

function createSignal(init) {
  const i = cursor++;
  if (!(i in store)) store[i] = init;
  const get = () => store[i];
  const set = (next) => {
    store[i] = typeof next === "function" ? next(store[i]) : next;
    return store[i];
  };
  return [get, set];
}

function h(tag, props, ...children) {
  return {
    tag,
    props: props ?? {},
    children: children
      .flat(Infinity)
      .filter((c) => c !== null && c !== undefined && c !== false),
  };
}

// ---- module plumbing ----------------------------------------------------
plugin({
  name: "counter-harness",
  setup(build) {
    build.module("solid-js", () => ({
      exports: { createSignal, h },
      loader: "object",
    }));
    build.onLoad({ filter: /\.css$/ }, () => ({
      contents: "export default new Proxy({}, { get: (_, k) => String(k) });",
      loader: "js",
    }));
    build.onLoad({ filter: /App\.jsx$/ }, async (args) => {
      const src = await Bun.file(args.path).text();
      const transpiler = new Bun.Transpiler({
        loader: "jsx",
        tsconfig: {
          compilerOptions: {
            jsx: "react",
            jsxFactory: "h",
            jsxFragmentFactory: "Fragment",
          },
        },
      });
      // The JSX factory h is provided by the stub solid-js module.
      const code = 'import { h } from "solid-js";\n' + transpiler.transformSync(src);
      return { contents: code, loader: "js" };
    });
  },
});

// ---- helpers ------------------------------------------------------------
let failures = 0;
function check(label, actual, expected) {
  if (Object.is(actual, expected)) {
    console.log(`ok: ${label} = ${JSON.stringify(actual)}`);
  } else {
    failures++;
    console.log(
      `FAIL: expected ${label} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function textOf(node) {
  if (node === null || node === undefined) return "";
  if (typeof node !== "object") return String(node);
  return node.children.map(textOf).join("");
}

function findByClass(node, cls) {
  if (!node || typeof node !== "object") return null;
  if (node.props?.class === cls) return node;
  for (const c of node.children) {
    const found = findByClass(c, cls);
    if (found) return found;
  }
  return null;
}

function findButton(node, label) {
  if (!node || typeof node !== "object") return null;
  if (node.tag === "button" && textOf(node).trim() === label) return node;
  for (const c of node.children) {
    const found = findButton(c, label);
    if (found) return found;
  }
  return null;
}

// Each render re-runs App(); state lives in the stub store, so the display
// reflects the signal value at render time.
function render(App) {
  cursor = 0;
  return App();
}

// ---- run ----------------------------------------------------------------
let App;
try {
  const mod = await import(pathToFileURL(appPath).href);
  App = mod.default;
} catch (err) {
  console.log(`FAIL: expected App.jsx to compile and load, got: ${err.message}`);
  process.exit(1);
}
check("App is a function", typeof App, "function");
if (typeof App !== "function") {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}

const readDisplay = (tree) => {
  const display = findByClass(tree, "countNumber");
  return display ? textOf(display).trim() : undefined;
};
const click = (tree, label) => {
  const btn = findButton(tree, label);
  if (!btn) {
    failures++;
    console.log(`FAIL: expected a button labelled ${label}, got none`);
    return;
  }
  btn.props.onClick();
};

let tree = render(App);
check("initial display", readDisplay(tree), "0");

click(tree, "+");
tree = render(App);
check("display after +", readDisplay(tree), "1");

click(tree, "+");
click(tree, "+");
tree = render(App);
check("display after +,+,+", readDisplay(tree), "3");

click(tree, "-");
click(tree, "-");
click(tree, "-");
click(tree, "-");
tree = render(App);
check("display after 3 more -, one extra -", readDisplay(tree), "-1");

check("buttons present", findButton(tree, "+") !== null && findButton(tree, "-") !== null, true);

if (failures > 0) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all counter checks passed");
