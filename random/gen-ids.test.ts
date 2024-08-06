import assert from "node:assert";

import { generateIdsGroupedByLocation as genIds } from "../packages/partysub/src/server/gen-ids";

function expectEqual(actual: unknown, expected: unknown) {
  try {
    assert.deepStrictEqual(actual, expected);
  } catch (err) {
    // console.log(`expected:`);
    // console.log(JSON.stringify(expected, null, 2));
    console.log(`actual:`);
    console.log(JSON.stringify(actual, null, 2));
    throw err;
  }
}

const defaultOutput = {
  afr: ["afr-0"],
  apac: ["apac-0"],
  eeur: ["eeur-0"],
  enam: ["enam-0"],
  me: ["me-0"],
  oc: ["oc-0"],
  sam: ["sam-0"],
  weur: ["weur-0"],
  wnam: ["wnam-0"]
};

expectEqual(genIds(), defaultOutput);

expectEqual(genIds(5, { enam: 1 }), {
  enam: ["enam-0", "enam-1", "enam-2", "enam-3", "enam-4"]
});

expectEqual(genIds(100), {
  wnam: [
    "wnam-0",
    "wnam-1",
    "wnam-2",
    "wnam-3",
    "wnam-4",
    "wnam-5",
    "wnam-6",
    "wnam-7",
    "wnam-8",
    "wnam-9",
    "wnam-10",
    "wnam-11"
  ],
  enam: [
    "enam-0",
    "enam-1",
    "enam-2",
    "enam-3",
    "enam-4",
    "enam-5",
    "enam-6",
    "enam-7",
    "enam-8",
    "enam-9",
    "enam-10"
  ],
  sam: [
    "sam-0",
    "sam-1",
    "sam-2",
    "sam-3",
    "sam-4",
    "sam-5",
    "sam-6",
    "sam-7",
    "sam-8",
    "sam-9",
    "sam-10"
  ],
  weur: [
    "weur-0",
    "weur-1",
    "weur-2",
    "weur-3",
    "weur-4",
    "weur-5",
    "weur-6",
    "weur-7",
    "weur-8",
    "weur-9",
    "weur-10"
  ],
  eeur: [
    "eeur-0",
    "eeur-1",
    "eeur-2",
    "eeur-3",
    "eeur-4",
    "eeur-5",
    "eeur-6",
    "eeur-7",
    "eeur-8",
    "eeur-9",
    "eeur-10"
  ],
  apac: [
    "apac-0",
    "apac-1",
    "apac-2",
    "apac-3",
    "apac-4",
    "apac-5",
    "apac-6",
    "apac-7",
    "apac-8",
    "apac-9",
    "apac-10"
  ],
  oc: [
    "oc-0",
    "oc-1",
    "oc-2",
    "oc-3",
    "oc-4",
    "oc-5",
    "oc-6",
    "oc-7",
    "oc-8",
    "oc-9",
    "oc-10"
  ],
  afr: [
    "afr-0",
    "afr-1",
    "afr-2",
    "afr-3",
    "afr-4",
    "afr-5",
    "afr-6",
    "afr-7",
    "afr-8",
    "afr-9",
    "afr-10"
  ],
  me: [
    "me-0",
    "me-1",
    "me-2",
    "me-3",
    "me-4",
    "me-5",
    "me-6",
    "me-7",
    "me-8",
    "me-9",
    "me-10"
  ]
});
