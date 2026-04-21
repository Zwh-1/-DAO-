PTAU（powers of tau）文件请放在本目录。

可选方式：
1) 将文件命名为下列之一，zk-setup / zk-setup-fast 会自动选用（按顺序匹配）：
   pot16_final.ptau, pot15_final.ptau, pot14_final.ptau, pot12_final.ptau,
   powersOfTau28_hez_final_14.ptau

2) 任意文件名：在运行 npm 脚本前设置环境变量，例如 PowerShell：
   $env:ZK_PTAU_FILE = "my-small.ptau"

注意：PTAU 的「幂次」必须 ≥ 当前电路 R1CS 所需；大电路若用小 PTAU，groth16 setup 会报错。
