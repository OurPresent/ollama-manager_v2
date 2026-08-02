#!/usr/bin/env python3
"""
Server-side handler for file actions required by the LLM.
Receives JSON via stdin with action details and executes them
within the project directory scope.

Usage:
    echo '{"action": "write_file", "project_path": "...", "path": "src/file.ts", "content": "..."}' | python actions.py

Security:
    All file operations are scoped to the project_path directory.
    Path traversal attempts are blocked.
"""

import sys
import json
import os
import subprocess


def validate_path(project_path: str, file_path: str) -> str:
    """
    Validate that the file_path is within the project_path.
    Resolves the full path and checks it's a subdirectory of project_path.
    Returns the full path if valid, raises ValueError if not.
    """
    if not project_path:
        # If no project path, allow any path (but this is discouraged)
        return os.path.abspath(file_path)

    # Resolve absolute paths
    abs_project = os.path.abspath(project_path)
    abs_file = os.path.abspath(os.path.join(project_path, file_path))

    # Security check: ensure the file is within the project directory.
    # Using commonpath prevents prefix spoofing (e.g. /project/evil when
    # project is /project/evi).
    try:
        common = os.path.commonpath([abs_project, abs_file])
    except ValueError:
        # Different drives on Windows -> always unsafe
        common = ""
    if common != abs_project:
        raise ValueError(
            f"Access denied: path '{file_path}' is outside project directory '{project_path}'"
        )

    return abs_file


def read_file(project_path: str, file_path: str) -> dict:
    """Read and return the contents of a file."""
    full_path = validate_path(project_path, file_path)

    if not os.path.exists(full_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    if not os.path.isfile(full_path):
        return {"success": False, "error": f"Not a file: {file_path}"}

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"success": True, "result": content, "path": file_path}
    except Exception as e:
        return {"success": False, "error": f"Error reading file: {str(e)}"}


def write_file(project_path: str, file_path: str, content: str = "") -> dict:
    """Write content to a file (creates or overwrites)."""
    full_path = validate_path(project_path, file_path)

    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return {"success": True, "result": f"File written: {file_path}"}
    except Exception as e:
        return {"success": False, "error": f"Error writing file: {str(e)}"}


def delete_file(project_path: str, file_path: str) -> dict:
    """Delete a file."""
    full_path = validate_path(project_path, file_path)

    if not os.path.exists(full_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    if not os.path.isfile(full_path):
        return {"success": False, "error": f"Not a file: {file_path}"}

    try:
        os.remove(full_path)
        return {"success": True, "result": f"File deleted: {file_path}"}
    except Exception as e:
        return {"success": False, "error": f"Error deleting file: {str(e)}"}


def list_files(project_path: str, dir_path: str = ".") -> dict:
    """List all files recursively in a directory."""
    full_path = validate_path(project_path, dir_path)

    if not os.path.exists(full_path):
        return {"success": False, "error": f"Directory not found: {dir_path}"}

    if not os.path.isdir(full_path):
        return {"success": False, "error": f"Not a directory: {dir_path}"}

    try:
        files = []
        for root, dirs, filenames in os.walk(full_path):
            for f in filenames:
                rel_path = os.path.relpath(os.path.join(root, f), full_path)
                files.append(rel_path)
        return {"success": True, "result": files, "path": dir_path}
    except Exception as e:
        return {"success": False, "error": f"Error listing files: {str(e)}"}


def create_directory(project_path: str, dir_path: str) -> dict:
    """Create a directory (and parents if needed)."""
    full_path = validate_path(project_path, dir_path)

    try:
        os.makedirs(full_path, exist_ok=True)
        return {"success": True, "result": f"Directory created: {dir_path}"}
    except Exception as e:
        return {"success": False, "error": f"Error creating directory: {str(e)}"}


def append_file(project_path: str, file_path: str, content: str = "") -> dict:
    """Append content to an existing file."""
    full_path = validate_path(project_path, file_path)

    if not os.path.exists(full_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    try:
        with open(full_path, 'a', encoding='utf-8') as f:
            f.write(content)
        return {"success": True, "result": f"Content appended to: {file_path}"}
    except Exception as e:
        return {"success": False, "error": f"Error appending to file: {str(e)}"}


def get_file_info(project_path: str, file_path: str) -> dict:
    """Get information about a file or directory."""
    full_path = validate_path(project_path, file_path)

    if not os.path.exists(full_path):
        return {"success": False, "error": f"Not found: {file_path}"}

    try:
        stat = os.stat(full_path)
        info = {
            "path": file_path,
            "size": stat.st_size,
            "is_file": os.path.isfile(full_path),
            "is_dir": os.path.isdir(full_path),
            "modified": stat.st_mtime,
            "created": stat.st_ctime,
        }
        return {"success": True, "result": info}
    except Exception as e:
        return {"success": False, "error": f"Error getting file info: {str(e)}"}


# ------------------------------------------------------------------
# OLLAMA HTTP API HELPERS
# ------------------------------------------------------------------

def ollama_api_request(ollama_url: str, path: str, method: str = "GET", payload: dict = None, timeout: int = 30):
    """Perform a request against the Ollama HTTP API."""
    import urllib.request
    url = ollama_url.rstrip("/") + path
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    else:
        data = None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        if not body.strip():
            return {}
        return json.loads(body)


def ollama_list_models(ollama_url: str = "http://localhost:11434") -> dict:
    """List installed models via GET /api/tags."""
    try:
        data = ollama_api_request(ollama_url, "/api/tags", timeout=10)
        return {"success": True, "result": data.get("models", [])}
    except Exception as e:
        return {"success": False, "error": f"Failed to list models: {str(e)}"}


def ollama_running_models(ollama_url: str = "http://localhost:11434") -> dict:
    """List models currently loaded in memory via GET /api/ps."""
    try:
        data = ollama_api_request(ollama_url, "/api/ps", timeout=10)
        return {"success": True, "result": data.get("models", [])}
    except Exception as e:
        return {"success": False, "error": f"Failed to list running models: {str(e)}"}


def ollama_load_model(ollama_url: str, model: str, keep_alive: str = "30m") -> dict:
    """Load a model into memory via POST /api/generate with an empty prompt."""
    if not model:
        return {"success": False, "error": "model is required"}
    try:
        data = ollama_api_request(
            ollama_url,
            "/api/generate",
            method="POST",
            payload={"model": model, "prompt": "", "stream": False, "keep_alive": keep_alive},
            timeout=120,
        )
        if data.get("done") or data.get("response") is not None:
            return {"success": True, "result": f"Model '{model}' loaded into memory"}
        return {"success": False, "error": f"Unexpected response for model '{model}'"}
    except Exception as e:
        return {"success": False, "error": f"Failed to load model '{model}': {str(e)}"}


def ollama_stop_model(ollama_url: str, model: str) -> dict:
    """Unload a model from memory via keep_alive=0."""
    if not model:
        return {"success": False, "error": "model is required"}
    try:
        ollama_api_request(
            ollama_url,
            "/api/generate",
            method="POST",
            payload={"model": model, "prompt": "", "stream": False, "keep_alive": 0},
            timeout=60,
        )
        return {"success": True, "result": f"Model '{model}' unloaded from memory"}
    except Exception as e:
        return {"success": False, "error": f"Failed to stop model '{model}': {str(e)}"}


# ------------------------------------------------------------------
# DOCKER / OLLAMA CONTROL FUNCTIONS (mode-aware)
# ------------------------------------------------------------------

def _run_cmd(args, timeout=10) -> tuple:
    """Run a subprocess command, returning (returncode, stdout, stderr)."""
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


def _check_local_ollama() -> dict:
    """Check if Ollama is running as a local process/service."""
    try:
        data = ollama_api_request("http://localhost:11434", "/api/tags", timeout=3)
        if isinstance(data, dict) and "models" in data:
            return {
                "success": True,
                "running": True,
                "mode": "local",
                "details": "Ollama running locally (port 11434)",
            }
    except Exception:
        pass
    return {
        "success": True,
        "running": False,
        "mode": "local",
        "details": "Ollama local process is not running",
    }


def _check_docker_ollama() -> dict:
    """Check if the Ollama Docker container is running."""
    try:
        result = subprocess.run(
            ['docker', 'ps', '--filter', 'name=ollama', '--format', '{{.Names}}\t{{.Status}}'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and 'ollama' in result.stdout.lower():
            lines = result.stdout.strip().split('\n')
            return {
                "success": True,
                "running": True,
                "mode": "docker",
                "details": lines[0] if lines else "Running in Docker"
            }
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception:
        pass

    try:
        result = subprocess.run(
            ['docker', 'ps', '-a', '--filter', 'name=ollama', '--format', '{{.Names}}\t{{.Status}}'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and 'ollama' in result.stdout.lower():
            lines = result.stdout.strip().split('\n')
            status_line = lines[0] if lines else ""
            if 'up' in status_line.lower():
                return {
                    "success": True,
                    "running": True,
                    "mode": "docker",
                    "details": status_line
                }
            return {
                "success": True,
                "running": False,
                "mode": "docker",
                "details": f"Docker container exists but not running: {status_line}"
            }
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception:
        pass

    return {
        "success": True,
        "running": False,
        "mode": "docker",
        "details": "Ollama Docker container not found"
    }


def docker_check_ollama(mode: str = None) -> dict:
    """Check if Ollama is running (Docker or local, honoring the configured mode)."""
    if mode == "docker":
        return _check_docker_ollama()
    if mode == "local":
        return _check_local_ollama()

    # Auto-detection: Docker first, then local
    docker_result = _check_docker_ollama()
    if docker_result.get("running"):
        return docker_result
    local_result = _check_local_ollama()
    if local_result.get("running"):
        return local_result
    return {
        "success": True,
        "running": False,
        "mode": "unknown",
        "details": "Ollama is not running (Docker or local)"
    }


def _start_docker_ollama() -> dict:
    """Start Ollama in Docker."""
    try:
        result = subprocess.run(
            ['docker', 'start', 'ollama'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return {
                "success": True,
                "result": "Ollama Docker container started",
                "output": result.stdout.strip()
            }
        result = subprocess.run(
            ['docker', 'run', '-d', '--name', 'ollama', '-p', '11434:11434', 'ollama/ollama'],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            return {
                "success": True,
                "result": "Ollama Docker container created and started",
                "output": result.stdout.strip()
            }
        return {
            "success": False,
            "error": f"Failed to start Ollama Docker: {result.stderr.strip()}"
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout starting Ollama Docker container"}
    except FileNotFoundError:
        return {"success": False, "error": "Docker is not installed or not in PATH"}
    except Exception as e:
        return {"success": False, "error": f"Error starting Ollama: {str(e)}"}


def _start_local_ollama() -> dict:
    """Start Ollama as a local process (ollama serve)."""
    if _check_local_ollama().get("running"):
        return {"success": True, "result": "Ollama local process already running"}
    try:
        subprocess.Popen(
            ['ollama', 'serve'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return {"success": True, "result": "Ollama local process started (ollama serve)"}
    except FileNotFoundError:
        return {"success": False, "error": "Ollama binary not found in PATH"}
    except Exception as e:
        return {"success": False, "error": f"Error starting Ollama locally: {str(e)}"}


def _stop_docker_ollama() -> dict:
    """Stop the Ollama Docker container."""
    try:
        result = subprocess.run(
            ['docker', 'stop', 'ollama'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return {
                "success": True,
                "result": "Ollama Docker container stopped",
                "output": result.stdout.strip()
            }
        return {
            "success": False,
            "error": f"Failed to stop Ollama Docker: {result.stderr.strip()}"
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout stopping Ollama Docker container"}
    except FileNotFoundError:
        return {"success": False, "error": "Docker is not installed or not in PATH"}
    except Exception as e:
        return {"success": False, "error": f"Error stopping Ollama: {str(e)}"}


def _stop_local_ollama() -> dict:
    """Stop the local Ollama process."""
    if not _check_local_ollama().get("running"):
        return {"success": True, "result": "Ollama local process is not running"}
    try:
        if sys.platform.startswith("win"):
            result = subprocess.run(
                ['taskkill', '/IM', 'ollama.exe', '/F'],
                capture_output=True, text=True, timeout=15
            )
        else:
            result = subprocess.run(
                ['pkill', '-f', 'ollama serve'],
                capture_output=True, text=True, timeout=15
            )
        if result.returncode == 0:
            return {"success": True, "result": "Ollama local process stopped"}
        return {"success": False, "error": f"Failed to stop Ollama local process: {result.stderr.strip()}"}
    except FileNotFoundError:
        return {"success": False, "error": "Could not find the process management tool"}
    except Exception as e:
        return {"success": False, "error": f"Error stopping Ollama locally: {str(e)}"}


def docker_start_ollama(mode: str = None) -> dict:
    """Start Ollama honoring the configured mode."""
    if mode == "local":
        return _start_local_ollama()
    if mode == "docker":
        return _start_docker_ollama()
    if mode is None:
        # Auto: prefer Docker
        return _start_docker_ollama()
    return {"success": False, "error": f"Unknown mode: {mode}"}


def docker_stop_ollama(mode: str = None) -> dict:
    """Stop Ollama honoring the configured mode."""
    if mode == "local":
        return _stop_local_ollama()
    if mode == "docker":
        return _stop_docker_ollama()
    if mode is None:
        return _stop_docker_ollama()
    return {"success": False, "error": f"Unknown mode: {mode}"}


def docker_restart_ollama(mode: str = None) -> dict:
    """Restart Ollama (stop + start) honoring the configured mode."""
    stop_result = docker_stop_ollama(mode)
    if not stop_result.get("success") and "not running" not in stop_result.get("result", "").lower():
        return stop_result
    return docker_start_ollama(mode)


def docker_get_info() -> dict:
    """Get Docker information and container status."""
    info = {
        "docker_installed": False,
        "docker_running": False,
        "containers": [],
        "ollama_container": None
    }

    # Check if Docker is installed
    try:
        result = subprocess.run(
            ['docker', '--version'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            info["docker_installed"] = True
            info["docker_version"] = result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return {"success": True, "result": info}

    # Check if Docker daemon is running
    try:
        result = subprocess.run(
            ['docker', 'info', '--format', '{{.ServerVersion}}'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            info["docker_running"] = True
            info["server_version"] = result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # List all containers
    try:
        result = subprocess.run(
            ['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                parts = line.split('\t')
                if len(parts) >= 4:
                    container = {
                        "name": parts[0],
                        "status": parts[1],
                        "image": parts[2],
                        "ports": parts[3]
                    }
                    info["containers"].append(container)
                    if 'ollama' in parts[0].lower():
                        info["ollama_container"] = container
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    return {"success": True, "result": info}


# ------------------------------------------------------------------
# SYSTEM STATS (RAM / process usage)
# ------------------------------------------------------------------

def _parse_tasklist_mem(lines) -> int:
    """Sum Working Set (KB) of processes from `tasklist /FO CSV` output."""
    import csv
    total = 0
    try:
        reader = csv.reader(lines)
        for row in reader:
            if len(row) >= 5 and row[0] != "Image Name":
                mem = row[4].replace(",", "").replace(" K", "").strip()
                if mem.isdigit():
                    total += int(mem)
    except Exception:
        pass
    return total * 1024  # KB -> bytes


def _ollama_ram_windows() -> int:
    """Return RAM bytes used by ollama.exe processes on Windows."""
    try:
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq ollama.exe', '/FO', 'CSV'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return _parse_tasklist_mem(result.stdout.strip().split('\n'))
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception:
        pass
    return 0


def _ollama_ram_linux() -> int:
    """Return RAM bytes used by ollama processes on Linux (sum of VmRSS)."""
    total = 0
    try:
        for pid_dir in os.listdir('/proc'):
            if not pid_dir.isdigit():
                continue
            try:
                with open(f'/proc/{pid_dir}/comm', 'r') as f:
                    comm = f.read().strip()
                if 'ollama' not in comm.lower():
                    continue
                with open(f'/proc/{pid_dir}/status', 'r') as f:
                    for line in f:
                        if line.startswith('VmRSS:'):
                            total += int(line.split()[1]) * 1024  # kB -> bytes
                            break
            except (IOError, ValueError, OSError):
                continue
    except OSError:
        pass
    return total


def _ollama_ram_darwin() -> int:
    """Return RAM bytes used by ollama processes on macOS via `ps`."""
    try:
        result = subprocess.run(
            ['ps', '-axo', 'rss,comm'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            total = 0
            for line in result.stdout.split('\n'):
                parts = line.split()
                if len(parts) >= 2 and 'ollama' in parts[1].lower():
                    try:
                        total += int(parts[0]) * 1024  # KB -> bytes
                    except ValueError:
                        pass
            return total
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return 0


def system_stats() -> dict:
    """Report system RAM usage (total, used, free) plus the Ollama process share."""
    total_ram = 0
    used_ram = 0
    free_ram = 0
    used_pct = 0
    ollama_ram = 0

    if sys.platform.startswith("win"):
        try:
            import ctypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            status = MEMORYSTATUSEX()
            status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
                total_ram = int(status.ullTotalPhys)
                free_ram = int(status.ullAvailPhys)
                used_ram = total_ram - free_ram
                used_pct = round((used_ram / total_ram) * 100, 1) if total_ram else 0
            ollama_ram = _ollama_ram_windows()
        except Exception as e:
            return {"success": False, "error": f"system_stats failed on Windows: {str(e)}"}
    elif sys.platform == "darwin":
        try:
            result = subprocess.run(
                ['sysctl', '-n', 'hw.memsize'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout.strip().isdigit():
                total_ram = int(result.stdout.strip())
            vm = subprocess.run(
                ['vm_stat'],
                capture_output=True, text=True, timeout=5
            )
            page_size = 4096
            try:
                ps_out = subprocess.run(
                    ['sysctl', '-n', 'hw.pagesize'],
                    capture_output=True, text=True, timeout=5
                )
                if ps_out.returncode == 0 and ps_out.stdout.strip().isdigit():
                    page_size = int(ps_out.stdout.strip())
            except Exception:
                pass
            free_pages = 0
            inactive_pages = 0
            if vm.returncode == 0:
                for line in vm.stdout.split('\n'):
                    if 'Pages free' in line:
                        free_pages = int(''.join(filter(str.isdigit, line.split(':')[-1])) or 0)
                    elif 'Pages inactive' in line:
                        inactive_pages = int(''.join(filter(str.isdigit, line.split(':')[-1])) or 0)
            free_ram = (free_pages + inactive_pages) * page_size
            used_ram = total_ram - free_ram
            used_pct = round((used_ram / total_ram) * 100, 1) if total_ram else 0
            ollama_ram = _ollama_ram_darwin()
        except Exception as e:
            return {"success": False, "error": f"system_stats failed on macOS: {str(e)}"}
    else:
        try:
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        if parts[0] == 'MemTotal:':
                            total_ram = int(parts[1]) * 1024  # kB -> bytes
                        elif parts[0] == 'MemAvailable:':
                            free_ram = int(parts[1]) * 1024
            used_ram = total_ram - free_ram
            used_pct = round((used_ram / total_ram) * 100, 1) if total_ram else 0
            ollama_ram = _ollama_ram_linux()
        except Exception as e:
            return {"success": False, "error": f"system_stats failed on Linux: {str(e)}"}

    return {
        "success": True,
        "result": {
            "total_ram": total_ram,
            "used_ram": used_ram,
            "free_ram": free_ram,
            "used_pct": used_pct,
            "ollama_ram": ollama_ram,
        }
    }


def execute_action(action_data: dict) -> dict:
    """
    Main dispatcher for file, Docker and Ollama actions.
    Expects:
        - action: str (required) - One of: read_file, write_file, delete_file,
          list_files, create_directory, append_file, get_file_info,
          docker_check_ollama, docker_start_ollama, docker_stop_ollama,
          docker_restart_ollama, docker_get_info, ollama_list_models,
          ollama_running_models, ollama_load_model, ollama_stop_model,
          system_stats
        - project_path: str (required for file actions) - The active project directory
        - path: str (required for most actions) - Relative path within project
        - content: str (optional) - File content for write/create actions
        - mode: str (optional) - 'docker' | 'local' for service control actions
        - ollama_url: str (optional) - Ollama API base URL
        - model: str (required for model load/stop actions)
    """
    action = action_data.get("action", "")
    project_path = action_data.get("project_path", "")
    file_path = action_data.get("path", "")
    content = action_data.get("content", "")
    mode = action_data.get("mode") or None
    ollama_url = action_data.get("ollama_url") or "http://localhost:11434"
    model = action_data.get("model", "")

    # Service control actions don't require project_path
    docker_actions = {
        "docker_check_ollama": lambda: docker_check_ollama(mode),
        "docker_start_ollama": lambda: docker_start_ollama(mode),
        "docker_stop_ollama": lambda: docker_stop_ollama(mode),
        "docker_restart_ollama": lambda: docker_restart_ollama(mode),
        "docker_get_info": lambda: docker_get_info(),
    }

    # Ollama model actions talk to the HTTP API and don't require project_path
    ollama_actions = {
        "ollama_list_models": lambda: ollama_list_models(ollama_url),
        "ollama_running_models": lambda: ollama_running_models(ollama_url),
        "ollama_load_model": lambda: ollama_load_model(ollama_url, model),
        "ollama_stop_model": lambda: ollama_stop_model(ollama_url, model),
    }

    if action == "system_stats":
        return system_stats()
    if action in docker_actions:
        return docker_actions[action]()
    if action in ollama_actions:
        return ollama_actions[action]()

    # File actions require project_path
    if not project_path:
        return {"success": False, "error": "project_path is required"}

    if not os.path.exists(project_path):
        return {"success": False, "error": f"Project path does not exist: {project_path}"}

    action_map = {
        "read_file": lambda: read_file(project_path, file_path),
        "write_file": lambda: write_file(project_path, file_path, content),
        "create_file": lambda: write_file(project_path, file_path, content),
        "delete_file": lambda: delete_file(project_path, file_path),
        "list_files": lambda: list_files(project_path, file_path or "."),
        "create_directory": lambda: create_directory(project_path, file_path),
        "mkdir": lambda: create_directory(project_path, file_path),
        "append_file": lambda: append_file(project_path, file_path, content),
        "get_file_info": lambda: get_file_info(project_path, file_path),
        "stat": lambda: get_file_info(project_path, file_path),
    }

    handler = action_map.get(action)
    if not handler:
        all_actions = list(action_map.keys()) + list(docker_actions.keys()) + list(ollama_actions.keys())
        return {"success": False, "error": f"Unknown action: {action}. Supported: {', '.join(all_actions)}"}

    return handler()


if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        result = execute_action(input_data)
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON input: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Unexpected error: {str(e)}"}))