cmake_minimum_required(VERSION 3.22.1)

project(t4highlights LANGUAGES C)

set(T4_HIGHLIGHTS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../..")

add_library(
  t4highlights SHARED
  T4_highlights_jni.c
  "${T4_HIGHLIGHTS_ROOT}/cpp/T4_highlights.c"
  "${T4_HIGHLIGHTS_ROOT}/Vendor/highlights/highlights.c"
  "${T4_HIGHLIGHTS_ROOT}/Vendor/wasm2c/wasm-rt-impl.c"
  "${T4_HIGHLIGHTS_ROOT}/Vendor/wasm2c/wasm-rt-mem-impl.c"
)

target_include_directories(
  t4highlights
  PRIVATE "${T4_HIGHLIGHTS_ROOT}/cpp" "${T4_HIGHLIGHTS_ROOT}/Vendor"
          "${T4_HIGHLIGHTS_ROOT}/Vendor/highlights" "${T4_HIGHLIGHTS_ROOT}/Vendor/wasm2c"
)

# Plain malloc memory with explicit bounds checks: no guard-page signal
# handlers competing with ART's.
target_compile_definitions(
  t4highlights PRIVATE WASM_RT_USE_MMAP=0 WASM_RT_MEMCHECK_BOUNDS_CHECK=1
                       WASM_RT_SKIP_SIGNAL_RECOVERY=1
)

# The lexers are generated code; keep them fast in debug builds too.
target_compile_options(t4highlights PRIVATE -O2)

target_link_options(
  t4highlights PRIVATE "-Wl,-z,common-page-size=16384" "-Wl,-z,max-page-size=16384"
)
