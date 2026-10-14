// The book's real proportions, in world units (about 1 mm of a 150 × 212 mm hardback).
// x runs from the spine to the fore-edge, y from head to tail, z up from the table.
export const W = 150; // board width
export const D = 212; // board height, head to tail
export const T = 30; // closed thickness, board to board
export const B = 3; // board thickness
export const SQ = 3; // squares: how far the boards overhang the text block
export const G = 24; // gutter: how far the spine lies open between the two halves
export const WP = W - SQ; // page width
export const Y0 = SQ; // page head
export const Y1 = D - SQ; // page tail
export const ZR = T - B; // top of the right-hand stack
export const PAGE_H = Y1 - Y0;
