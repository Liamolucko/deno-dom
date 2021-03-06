import { assertEquals } from "https://deno.land/std@0.75.0/testing/asserts.ts";
import { dirname, join, basename } from "https://deno.land/std@0.75.0/path/mod.ts";
import { DOMParser, Element } from "../deno-dom-wasm.ts";

const parser = new DOMParser();
const cachedScripts: {[script: string]: string} = {};
export type Backend = "wasm" | "native";

export async function run(path: string, root: string, backend: Backend) {
  const html = await Deno.readTextFile(path);
  const doc = parser.parseFromString(html, "text/html")!;
  let scripts = Array.from(doc.querySelectorAll("script")).map(scriptNode => {
    const scriptElement = scriptNode as Element;
    let script = scriptElement.getAttribute("src")!;
    let scriptContents: string;

    if (script) {
      if (script[0] === "/") {
        script = root + script;
      } else {
        script = join(dirname(path), script);
      }

      if (cachedScripts[script]) {
        scriptContents = cachedScripts[script];
      } else {
        scriptContents = cachedScripts[script] = Deno.readTextFileSync(script);
      }
    } else {
      scriptContents = scriptElement.textContent;
    }

    return scriptContents;
  });

  const worker = new Worker(new URL("./runner-worker-wasm.ts", import.meta.url).href, { type: "module" });
  worker.postMessage({
    backend,
    html,
    scripts,
  });

  await new Promise((resolve, reject) => {
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      worker.terminate();
      reject(event);
    });

    worker.addEventListener("message", (event) => {
      worker.terminate();
      resolve();
    });
  });
}

