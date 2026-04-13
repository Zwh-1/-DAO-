pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// 禁止使用 MD5 / SHA-1；电路内统一 Poseidon。
template PoseidonHasher3() {
    signal input in0;
    signal input in1;
    signal input in2;
    signal output out;

    component p = Poseidon(3);
    p.inputs[0] <== in0;
    p.inputs[1] <== in1;
    p.inputs[2] <== in2;
    out <== p.out;
}

template PoseidonHasher2() {
    signal input in0;
    signal input in1;
    signal output out;

    component p = Poseidon(2);
    p.inputs[0] <== in0;
    p.inputs[1] <== in1;
    out <== p.out;
}
