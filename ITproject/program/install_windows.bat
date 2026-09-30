@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title AI Product Scan - First Time Setup

set "PYTHON="
where py >nul 2>&1
if not errorlevel 1 (
  py -3.12 -c "import sys; print(sys.version)" >nul 2>&1 && set "PYTHON=py -3.12"
  if not defined PYTHON py -3.11 -c "import sys; print(sys.version)" >nul 2>&1 && set "PYTHON=py -3.11"
  if not defined PYTHON py -3.13 -c "import sys; print(sys.version)" >nul 2>&1 && set "PYTHON=py -3.13"
)
if not defined PYTHON (
  where python >nul 2>&1
  if not errorlevel 1 set "PYTHON=python"
)
if not defined PYTHON (
  echo [ERROR] ไม่พบ Python 3.11-3.13
  echo กรุณาติดตั้ง Python จาก https://www.python.org/downloads/windows/
  echo ระหว่างติดตั้งให้เลือก Add Python to PATH
  pause
  exit /b 1
)

for /f "tokens=2" %%V in ('%PYTHON% -c "import sys; print(sys.version_info[0], sys.version_info[1])"') do set "PYVER=%%V"
if "%PYVER%"=="14" (
  echo [ERROR] พบ Python 3.14 ซึ่งยังไม่รองรับ PyTorch ในชุดนี้
  echo กรุณาติดตั้ง Python 3.11, 3.12 หรือ 3.13 แล้วรันไฟล์นี้ใหม่
  pause
  exit /b 1
)

if not exist ".runtime\Scripts\python.exe" (
  echo [1/3] กำลังสร้าง environment สำหรับโปรแกรม...
  %PYTHON% -m venv .runtime
  if errorlevel 1 goto :fail
)

echo [2/3] กำลังติดตั้งส่วนประกอบโปรแกรม (ต้องใช้อินเทอร์เน็ตครั้งแรก)...
.runtime\Scripts\python.exe -m pip install --upgrade pip
.runtime\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo [3/3] ติดตั้งเสร็จแล้ว
if not exist "index_data\product_index.faiss" (
  echo [WARNING] ยังไม่พบ index สินค้า โปรแกรมยังค้นหาไม่ได้
  echo กรุณาคัดลอกโฟลเดอร์ index_data ที่มีไฟล์ index เข้ามาในโฟลเดอร์นี้
)
echo.
echo พร้อมใช้งานแล้ว ให้ดับเบิลคลิก start_app.bat
pause
exit /b 0

:fail
echo.
echo [ERROR] ติดตั้งไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและข้อความด้านบน
pause
exit /b 1
