const MinHeap = require("../dsa/MinHeap");

describe("MinHeap", () => {
  it("pops items in ascending priority order", () => {
    const heap = new MinHeap();
    [5, 1, 4, 2, 8, 0, 3].forEach((p) => heap.push({ priority: p }));
    const out = [];
    while (!heap.isEmpty()) out.push(heap.pop().priority);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 8]);
  });

  it("handles duplicate priorities correctly", () => {
    const heap = new MinHeap();
    heap.push({ priority: 3, id: "a" });
    heap.push({ priority: 3, id: "b" });
    heap.push({ priority: 1, id: "c" });
    expect(heap.pop().id).toBe("c");
    const rest = [heap.pop().priority, heap.pop().priority];
    expect(rest).toEqual([3, 3]);
  });

  it("returns null when popping an empty heap", () => {
    const heap = new MinHeap();
    expect(heap.pop()).toBeNull();
  });

  it("supports a custom comparator (max-heap behavior)", () => {
    const heap = new MinHeap((a, b) => b.priority - a.priority);
    [1, 5, 3].forEach((p) => heap.push({ priority: p }));
    expect(heap.pop().priority).toBe(5);
  });
});
