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

function smoke() {
  const { main, server, client } = loadDist();

  expectKeys(
    main,
    [
      "arrayOps",
      "field",
      "inputTypeFor",
      "vesicle",
      "buildFormData",
      "objectFromFormData",
      "readFormPayload",
      "SubmitButton",
      "useFormStatus",
      "useVesicle",
      "useVesicleAction",
      "useVesicleDirty",
      "useVesicleOptimistic",
      "useVesiclePending",
      "useVesicleValid",
      "useVesicleValues",
    ],
    "FlowVesicle.js"
  );

  expectKeys(
    server,
    [
      "arrayOps",
      "field",
      "inputTypeFor",
      "vesicle",
      "buildFormData",
      "objectFromFormData",
      "readFormPayload",
    ],
    "Server.js"
  );

  expectKeys(
    client,
    [
      "SubmitButton",
      "useFormStatus",
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

  console.log("smoke: ok");
}

smoke();
