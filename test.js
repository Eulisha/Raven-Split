// const graph = {
//   A: { B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
//   B: { A: 0, C: 40, D: 0, E: 0, F: 0, G: 0 },
//   C: { A: 0, B: 0, D: 20, E: 0, F: 0, G: 0 },
//   D: { A: 0, B: 0, C: 0, E: 50, F: 0, G: 0 },
//   E: { A: 0, B: 0, C: 0, D: 0, F: 0, G: 0 },
//   F: { A: 0, B: 10, C: 30, D: 10, E: 10, G: 0 },
//   G: { A: 0, B: 30, C: 0, D: 10, E: 0, F: 0 },
// };
// const graph1 = [
//     A, B, C, D, E, F, G
//  A [0, 0, 0, 0, 0, 0, 0],
//  B [0, 0, 40, 0, 0, 0, 0],
//  C [0, 0, 0, 20, 0, 0, 0],
//  D [0, 0, 0, 0, 50, 0, 0],
//  E [0, 0, 0, 0, 0, 0, 0],
//  F [0, 10, 30, 10, 10, 0, 0],
//  G [0, 30, 0, 10, 0, 0, 0],
// ];

// const pathsStructure = {
//   sourceName: {
//     sinksSummary: { sinks: [B, C, D, E], qty: 4 },
//     sinks: {
//       sinkName: [[[F,E]], [[F,D], [D,E]]]
//     },
//   },
// };

// b: { c: 40 },
// c: { d: 20 },
// d: { e: 50 },
// e: {},
// f: { b: 30, d: 10 },
// g: { b: 10, c: 30, d: 10, e: 10 },
// a: {}

let a = [
  ['a', 'b'],
  ['b', 'c'],
];
b = a.flat();
console.log(b);
if ('a' in b) {
  console.log('true');
}
