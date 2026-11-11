const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { barColor } = require("./markup");

const level = (c) => Number(c.pattern.image.match(/gray-(\d)\.png/)[1]);

describe("barColor", () => {
  it("is white below 5 c/kWh", () => {
    assert.equal(barColor(-1), "#FFFFFF");
    assert.equal(barColor(4.99), "#FFFFFF");
  });

  it("is black above 25 c/kWh", () => {
    assert.equal(barColor(25.01), "#000000");
    assert.equal(barColor(100), "#000000");
  });

  it("uses gray patterns between, darkening with price", () => {
    assert.equal(level(barColor(5)), 7);
    assert.equal(level(barColor(15)), 4);
    assert.equal(level(barColor(25)), 1);
    let prev = 8;
    for (let p = 5; p <= 25; p += 0.5) {
      const l = level(barColor(p));
      assert.ok(l <= prev);
      prev = l;
    }
  });
});
