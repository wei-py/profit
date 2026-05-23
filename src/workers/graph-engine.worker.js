import { executeFlow } from "../services/graph-engine";

globalThis.onmessage = (event) => {
  const { batchInputs, flow, lookupTables } = event.data;
  try {
    const results = batchInputs.map(inputs => executeFlow(flow, lookupTables, inputs));
    globalThis.postMessage({ results, success: true });
  }
  catch (error) {
    globalThis.postMessage({ error: error.message, success: false });
  }
};
