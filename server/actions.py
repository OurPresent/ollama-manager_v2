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

    # Security check: ensure the file is within the project directory
    if not abs_file.startswith(abs_project):
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
# DOCKER / OLLAMA CONTROL FUNCTIONS
# ------------------------------------------------------------------

def docker_check_ollama() -> dict:
    """Check if Ollama is running (Docker or local)."""
    # First try Docker
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
    except Exception as e:
        pass

    # Try local Ollama (check if process is running)
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
            else:
                return {
                    "success": True,
                    "running": False,
                    "mode": "docker",
                    "details": f"Docker container exists but not running: {status_line}"
                }
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception as e:
        pass

    # Check if Ollama is running locally (not in Docker)
    try:
        import urllib.request
        req = urllib.request.Request('http://localhost:11434/api/tags', method='GET')
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                return {
                    "success": True,
                    "running": True,
                    "mode": "local",
                    "details": "Ollama running locally (port 11434)"
                }
    except Exception:
        pass

    return {
        "success": True,
        "running": False,
        "mode": "unknown",
        "details": "Ollama is not running (Docker or local)"
    }


def docker_start_ollama() -> dict:
    """Start Ollama in Docker."""
    try:
        # Try to start existing container
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
        # If container doesn't exist, try to run it
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


def docker_stop_ollama() -> dict:
    """Stop Ollama in Docker."""
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


def docker_restart_ollama() -> dict:
    """Restart Ollama in Docker."""
    try:
        result = subprocess.run(
            ['docker', 'restart', 'ollama'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return {
                "success": True,
                "result": "Ollama Docker container restarted",
                "output": result.stdout.strip()
            }
        return {
            "success": False,
            "error": f"Failed to restart Ollama Docker: {result.stderr.strip()}"
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout restarting Ollama Docker container"}
    except FileNotFoundError:
        return {"success": False, "error": "Docker is not installed or not in PATH"}
    except Exception as e:
        return {"success": False, "error": f"Error restarting Ollama: {str(e)}"}


def execute_action(action_data: dict) -> dict:
    """
    Main dispatcher for file and Docker actions.
    Expects:
        - action: str (required) - One of: read_file, write_file, delete_file,
          list_files, create_directory, append_file, get_file_info,
          docker_check_ollama, docker_start_ollama, docker_stop_ollama,
          docker_restart_ollama, docker_get_info
        - project_path: str (required for file actions) - The active project directory
        - path: str (required for most actions) - Relative path within project
        - content: str (optional) - File content for write/create actions
    """
    action = action_data.get("action", "")
    project_path = action_data.get("project_path", "")
    file_path = action_data.get("path", "")
    content = action_data.get("content", "")

    # Docker actions don't require project_path
    docker_actions = {
        "docker_check_ollama": docker_check_ollama,
        "docker_start_ollama": docker_start_ollama,
        "docker_stop_ollama": docker_stop_ollama,
        "docker_restart_ollama": docker_restart_ollama,
        "docker_get_info": docker_get_info,
    }

    if action in docker_actions:
        return docker_actions[action]()

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
        all_actions = list(action_map.keys()) + list(docker_actions.keys())
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