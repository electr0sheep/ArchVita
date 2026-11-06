cmake_minimum_required(VERSION 3.10)

if(NOT DEFINED CMAKE_TOOLCHAIN_FILE)
  if(DEFINED ENV{VITASDK})
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VITASDK}/share/vita.toolchain.cmake" CACHE PATH "toolchain file")
  else()
    message(FATAL_ERROR "Please define VITASDK to point to your SDK path!")
  endif()
endif()

project(archvita_launcher C)
include("${VITASDK}/share/vita.cmake" REQUIRED)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -O2")

add_executable(${PROJECT_NAME} src/main.c)

target_link_libraries(${PROJECT_NAME}
  SceAppMgr_stub
  SceIofilemgr_stub
  SceProcessmgr_stub
  SceLibKernel_stub
)

vita_create_self(eboot.bin ${PROJECT_NAME} UNSAFE)
