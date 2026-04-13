@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set CIRCUIT_NAME=%~1
if "%CIRCUIT_NAME%"=="" set CIRCUIT_NAME=identity_commitment

echo ================================================================
echo  Circuit Compilation Started
echo  Target: %CIRCUIT_NAME%
echo ================================================================
echo.

:: 路径定义：统一以 SCRIPT_DIR（circuits/ 根目录）为基准，消除歧义
set SCRIPT_DIR=%~dp0
set LIB_DIR=%SCRIPT_DIR%node_modules\circomlib\circuits
set BUILD_DIR=%SCRIPT_DIR%build
set OUTPUT_DIR=%BUILD_DIR%\%CIRCUIT_NAME%
set CIRCUIT_PATH=

:: 搜索电路文件（src/ 优先于 claims/）
if exist "%SCRIPT_DIR%src\%CIRCUIT_NAME%.circom" (
    set CIRCUIT_PATH=%SCRIPT_DIR%src\%CIRCUIT_NAME%.circom
) else if exist "%SCRIPT_DIR%claims\%CIRCUIT_NAME%.circom" (
    set CIRCUIT_PATH=%SCRIPT_DIR%claims\%CIRCUIT_NAME%.circom
) else (
    echo ERROR: Circuit file not found: %CIRCUIT_NAME%.circom
    echo        Searched in: %SCRIPT_DIR%src\  and  %SCRIPT_DIR%claims\
    exit /b 1
)

echo  Found circuit: %CIRCUIT_PATH%
echo  Output dir:    %OUTPUT_DIR%
echo.

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

:: ── 状态清理（防止旧产物污染新一轮编译）───────────────────────────────────
echo Cleaning previous build artifacts...

:: r1cs / sym / wasm
del /f /q "%OUTPUT_DIR%\%CIRCUIT_NAME%.r1cs"   2>nul
del /f /q "%OUTPUT_DIR%\%CIRCUIT_NAME%.sym"    2>nul
rmdir /s /q "%OUTPUT_DIR%\%CIRCUIT_NAME%_js"   2>nul

:: [修复: 状态清理不彻底] 同步清理 zkey 与 vkey，防止旧密钥验证新证明产生难以
:: 排查的错误（zkey 与 r1cs 必须来自同一次可信设置，两者须同步更新）
del /f /q "%OUTPUT_DIR%\%CIRCUIT_NAME%_0000.zkey"  2>nul
del /f /q "%OUTPUT_DIR%\%CIRCUIT_NAME%_final.zkey" 2>nul
del /f /q "%OUTPUT_DIR%\verification_key.json"      2>nul

:: 清理可能残留在 src/ 或 claims/ 中的编译产物
del /f /q "%SCRIPT_DIR%src\%CIRCUIT_NAME%.r1cs"  2>nul
del /f /q "%SCRIPT_DIR%src\%CIRCUIT_NAME%.sym"   2>nul
rmdir /s /q "%SCRIPT_DIR%src\%CIRCUIT_NAME%_js"  2>nul
del /f /q "%SCRIPT_DIR%claims\%CIRCUIT_NAME%.r1cs"  2>nul
del /f /q "%SCRIPT_DIR%claims\%CIRCUIT_NAME%.sym"   2>nul
rmdir /s /q "%SCRIPT_DIR%claims\%CIRCUIT_NAME%_js"  2>nul

echo.
echo [1/2] Compiling circuit...
echo.

:: [修复: 路径引用冲突]
:: 移除了 -l "%SRC_DIR%"（即 circuits/src/），该路径会与 circuits/claims/ 下的同名
:: 工具文件产生搜索歧义，导致编译器可能加载错误版本的组件。
::
:: 现在仅使用两个无歧义的 -l 路径：
::   1. SCRIPT_DIR（circuits/ 根目录）：覆盖所有相对于项目根的非相对路径引用
::   2. LIB_DIR（circomlib/circuits/）：覆盖非相对路径的官方库引用（如 "poseidon.circom"）
:: 各电路文件内的相对路径 include（如 "../node_modules/..."、"./utils/..."）
:: 由 circom 编译器按文件位置直接解析，无需 -l 干预。
node "%SCRIPT_DIR%node_modules\circom2\cli.js" "%CIRCUIT_PATH%" ^
    --r1cs --wasm --sym ^
    -o "%OUTPUT_DIR%" ^
    -l "%SCRIPT_DIR%" ^
    -l "%LIB_DIR%"

if errorlevel 1 (
    echo.
    echo ================================================================
    echo  Compile FAILED — see errors above for details
    echo ================================================================
    exit /b 1
)

echo.
echo [2/2] Verifying output...
echo.

if not exist "%OUTPUT_DIR%\%CIRCUIT_NAME%.r1cs" (
    echo ERROR: R1CS missing from output dir
    exit /b 1
)
if not exist "%OUTPUT_DIR%\%CIRCUIT_NAME%.sym" (
    echo ERROR: SYM missing from output dir
    exit /b 1
)

echo ================================================================
echo  Compile SUCCESS
echo ================================================================
echo  R1CS: %OUTPUT_DIR%\%CIRCUIT_NAME%.r1cs
echo  SYM : %OUTPUT_DIR%\%CIRCUIT_NAME%.sym
echo  WASM: %OUTPUT_DIR%\%CIRCUIT_NAME%_js\%CIRCUIT_NAME%.wasm
echo ================================================================
echo.
echo  Next steps (Trusted Setup — 电路变更后必须重新执行):
echo.
echo  snarkjs groth16 setup ^
echo      "%OUTPUT_DIR%\%CIRCUIT_NAME%.r1cs" ^
echo      params\pot12_final.ptau ^
echo      "%OUTPUT_DIR%\%CIRCUIT_NAME%_0000.zkey"
echo.
echo  snarkjs zkey contribute ^
echo      "%OUTPUT_DIR%\%CIRCUIT_NAME%_0000.zkey" ^
echo      "%OUTPUT_DIR%\%CIRCUIT_NAME%_final.zkey" ^
echo      -n="Contributor_1" -v
echo.
echo  snarkjs zkey export verificationkey ^
echo      "%OUTPUT_DIR%\%CIRCUIT_NAME%_final.zkey" ^
echo      "%OUTPUT_DIR%\verification_key.json"
echo.

endlocal
exit /b 0
