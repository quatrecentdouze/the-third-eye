cmake_minimum_required(VERSION 3.20)
project(the_third_eye LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# --- Build info defines ---
set(THIRD_EYE_VERSION "1.1.1")

# Detect git commit hash (or "unknown")
execute_process(
    COMMAND git rev-parse --short HEAD
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE THIRD_EYE_GIT_COMMIT
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
    RESULT_VARIABLE GIT_RESULT
)
if(NOT GIT_RESULT EQUAL 0)
    set(THIRD_EYE_GIT_COMMIT "unknown")
endif()

# Detect platform
if(WIN32)
    set(THIRD_EYE_PLATFORM "windows")
elseif(UNIX)
    set(THIRD_EYE_PLATFORM "linux")
else()
    set(THIRD_EYE_PLATFORM "unknown")
endif()

# Detect compiler
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    set(THIRD_EYE_COMPILER "gcc")
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
    set(THIRD_EYE_COMPILER "clang")
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
    set(THIRD_EYE_COMPILER "msvc")
else()
    set(THIRD_EYE_COMPILER "unknown")
endif()

# --- Common sources ---
set(COMMON_SOURCES
    src/main.cpp
    src/agent.cpp
    src/registry.cpp
    src/http_server.cpp
)

# --- Platform-specific collector sources ---
if(WIN32)
    set(PLATFORM_SOURCES
        src/collectors/cpu_windows.cpp
        src/collectors/memory_windows.cpp
        src/collectors/system_windows.cpp
        src/collectors/process_windows.cpp
    )
else()
    set(PLATFORM_SOURCES "")
endif()

# --- Executable ---
add_executable(${PROJECT_NAME} ${COMMON_SOURCES} ${PLATFORM_SOURCES})

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}/include
)

# --- Build info compile definitions ---
target_compile_definitions(${PROJECT_NAME} PRIVATE
    THIRD_EYE_VERSION="${THIRD_EYE_VERSION}"
    THIRD_EYE_GIT_COMMIT="${THIRD_EYE_GIT_COMMIT}"
    THIRD_EYE_PLATFORM="${THIRD_EYE_PLATFORM}"
    THIRD_EYE_COMPILER="${THIRD_EYE_COMPILER}"
)

# --- Compiler warnings ---
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -Wpedantic)
    # Static link C++ runtime for standalone binary (no DLL dependencies)
    target_link_options(${PROJECT_NAME} PRIVATE -static -static-libgcc -static-libstdc++)
endif()

# --- Platform libraries ---
if(WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE ws2_32 psapi)
endif()
