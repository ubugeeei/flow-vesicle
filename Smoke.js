"use strict";

const assert = require("node:assert/strict");
const path = require("path");

const distDir = path.join(__dirname, "dist");

function loadDist() {
  return {
    main: require(path.join(distDir, "FlowVesicle.js")),
    server: require(path.join(distDir, "Server.js")),
    client: require(path.join(distDir, "Client.js")),
  };
}

function expectKeys(obj, names, label) {
  for (const name of names) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(obj, name),
      `${label} is missing export '${name}'`
    );
  }
}

async function smoke() {
  const { main, server, client } = loadDist();

  expectKeys(
    main,
    [
      "GraphQLBridgeError",
      "VesicleField",
      "VesicleForm",
      "applyGraphQLErrors",
      "arrayOps",
      "buildFormData",
      "field",
      "inputTypeFor",
      "objectFromFormData",
      "readFormPayload",
      "SubmitButton",
      "useFormStatus",
      "useUnsavedChangesGuard",
      "useVesicle",
      "useVesicleAction",
      "useVesicleDirty",
      "useVesicleOptimistic",
      "useVesiclePending",
      "useVesicleValid",
      "useVesicleValues",
      "vesicle",
      "vesicleFromMutation",
    ],
    "FlowVesicle.js"
  );

  expectKeys(
    server,
    [
      "GraphQLBridgeError",
      "VesicleField",
      "VesicleForm",
      "applyGraphQLErrors",
      "arrayOps",
      "buildFormData",
      "field",
      "inputTypeFor",
      "objectFromFormData",
      "readFormPayload",
      "vesicle",
      "vesicleFromMutation",
    ],
    "Server.js"
  );

  expectKeys(
    client,
    [
      "SubmitButton",
      "useFormStatus",
      "useUnsavedChangesGuard",
      "useVesicle",
      "useVesicleAction",
      "useVesicleDirty",
      "useVesicleOptimistic",
      "useVesiclePending",
      "useVesicleValid",
      "useVesicleValues",
    ],
    "Client.js"
  );

  const definition = main.vesicle({
    fields: {
      title: main.field.text({ required: true }),
      done: main.field.checkbox(),
    },
  });

  const handle = definition.bind();
  assert.equal(typeof handle.id, "string");
  assert.deepEqual(handle.values.get(), { title: "", done: false });

  handle.fields.title.set("hello");
  assert.equal(handle.values.get().title, "hello");
  assert.equal(handle.dirty.get(), true);

  const repeat = main.vesicle({
    fields: { tags: main.field.array(main.field.text()) },
    initial: { tags: ["red"] },
  }).bind();
  const ops = main.arrayOps(repeat.fields.tags);
  ops.push("blue");
  ops.insertAt(0, "green");
  ops.removeAt(2);
  assert.deepEqual(repeat.values.get().tags, ["green", "red"]);

  const formData = main.buildFormData({ a: "1", flag: true, list: ["x", "y"] });
  assert.equal(formData.get("a"), "1");
  assert.equal(formData.get("flag"), "on");
  assert.deepEqual(formData.getAll("list"), ["x", "y"]);

  const gqlBridge = main.vesicleFromMutation({
    mutation: "mutation Smoke($name:String!){smoke(name:$name){id}}",
    fields: { name: main.field.text() },
    fetch: async ({ variables }) => ({ data: { smoke: { id: variables.name } } }),
  });
  const gqlResult = await gqlBridge.bind().action(main.buildFormData({ name: "ada" }));
  assert.deepEqual(gqlResult, { smoke: { id: "ada" } });

  console.log("smoke: ok");
}

smoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
