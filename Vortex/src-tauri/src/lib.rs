use tauri::command;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FsEntry>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ShellCommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitStatusResult {
    pub branch: String,
    pub is_clean: bool,
    pub changed_files: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DetailedGitStatus {
    pub branch: String,
    pub is_clean: bool,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileChange>,
    pub unstaged: Vec<GitFileChange>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub commit_hash: String,
    pub commit_message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub relative_time: String,
    pub date: String,
    pub message: String,
    pub parents: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitStashInfo {
    pub index: usize,
    pub name: String,
    pub branch: String,
    pub message: String,
    pub relative_time: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitBlameInfo {
    pub commit_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub relative_time: String,
    pub line_number: usize,
    pub line_content: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SearchResultMatch {
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SearchResultEntry {
    pub path: String,
    pub file_name: String,
    pub matches: Vec<SearchResultMatch>,
}

fn should_ignore_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | ".git"
            | ".vscode"
            | ".idea"
            | ".DS_Store"
            | "dist"
            | ".next"
            | ".turbo"
            | "build"
    )
}

fn scan_directory(dir: &Path, depth: usize, max_depth: usize) -> Result<Vec<FsEntry>, String> {
    if depth > max_depth {
        return Ok(Vec::new());
    }

    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut entries: Vec<FsEntry> = Vec::new();

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();
        if should_ignore_name(&file_name) {
            continue;
        }

        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        let is_dir = path.is_dir();

        let children = if is_dir {
            Some(scan_directory(&path, depth + 1, max_depth)?)
        } else {
            None
        };

        entries.push(FsEntry {
            name: file_name,
            path: path_str,
            is_dir,
            children,
        });
    }

    // Sort folders first, then alphabetical
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[command]
async fn read_dir_tree(path: Option<String>) -> Result<Vec<FsEntry>, String> {
    let target_dir = match path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    scan_directory(&target_dir, 0, 10)
}

#[command]
async fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[command]
async fn write_file_content(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

#[command]
async fn create_file(path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    if !Path::new(&path).exists() {
        fs::write(&path, "").map_err(|e| format!("Failed to create file: {}", e))?;
    }
    Ok(())
}

#[command]
async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
}

#[command]
async fn delete_entry(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|e| format!("Failed to remove directory: {}", e))
    } else if target.exists() {
        fs::remove_file(target).map_err(|e| format!("Failed to remove file: {}", e))
    } else {
        Ok(())
    }
}

#[command]
async fn rename_entry(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))
}

#[command]
async fn execute_shell_command(command: String, cwd: Option<String>) -> Result<ShellCommandResult, String> {
    tokio::task::spawn_blocking(move || {
        let start_time = Instant::now();
        let working_dir = match cwd {
            Some(dir) if !dir.trim().is_empty() && Path::new(&dir).exists() => PathBuf::from(dir),
            _ => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
        };

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd");
            c.arg("/C").arg(&command);
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("sh");
            c.arg("-c").arg(&command);
            c
        };

        cmd.current_dir(&working_dir);

        match cmd.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(if output.status.success() { 0 } else { 1 });
                let duration_ms = start_time.elapsed().as_millis() as u64;

                Ok(ShellCommandResult {
                    stdout,
                    stderr,
                    exit_code,
                    duration_ms,
                })
            }
            Err(e) => Err(format!("Failed to execute command '{}': {}", command, e)),
        }
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
fn get_working_dir(cwd: Option<String>) -> PathBuf {
    match cwd {
        Some(dir) if !dir.trim().is_empty() && Path::new(&dir).exists() => PathBuf::from(dir),
        _ => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    }
}

#[command]
async fn get_git_status(cwd: Option<String>) -> Result<GitStatusResult, String> {
    let working_dir = get_working_dir(cwd);

    let branch_output = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .current_dir(&working_dir)
        .output();

    let branch = match branch_output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "main".to_string(),
    };

    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(&working_dir)
        .output();

    let mut changed_files = Vec::new();
    let mut is_clean = true;

    if let Ok(out) = status_output {
        if out.status.success() {
            let output_str = String::from_utf8_lossy(&out.stdout);
            for line in output_str.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    changed_files.push(trimmed.to_string());
                }
            }
            is_clean = changed_files.is_empty();
        }
    }

    Ok(GitStatusResult {
        branch,
        is_clean,
        changed_files,
    })
}

#[command]
async fn get_detailed_git_status(cwd: Option<String>) -> Result<DetailedGitStatus, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);

        // Current branch
        let branch_output = Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(&working_dir)
            .output();

        let branch = match branch_output {
            Ok(out) if out.status.success() => {
                let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if name == "HEAD" {
                    "detached HEAD".to_string()
                } else {
                    name
                }
            }
            _ => "main".to_string(),
        };

        // Ahead / Behind
        let mut ahead = 0;
        let mut behind = 0;
        if let Ok(ab_out) = Command::new("git")
            .args(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
            .current_dir(&working_dir)
            .output()
        {
            if ab_out.status.success() {
                let text = String::from_utf8_lossy(&ab_out.stdout);
                let parts: Vec<&str> = text.trim().split_whitespace().collect();
                if parts.len() == 2 {
                    ahead = parts[0].parse::<usize>().unwrap_or(0);
                    behind = parts[1].parse::<usize>().unwrap_or(0);
                }
            }
        }

        // Status porcelain
        let status_output = Command::new("git")
            .args(["status", "--porcelain=v1", "-uall"])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Failed to run git status: {}", e))?;

        let mut staged: Vec<GitFileChange> = Vec::new();
        let mut unstaged: Vec<GitFileChange> = Vec::new();
        let mut untracked: Vec<String> = Vec::new();
        let mut conflicted: Vec<String> = Vec::new();

        if status_output.status.success() {
            let output_str = String::from_utf8_lossy(&status_output.stdout);
            for line in output_str.lines() {
                if line.len() < 3 {
                    continue;
                }
                let chars: Vec<char> = line.chars().collect();
                let x = chars[0];
                let y = chars[1];
                let path_raw = if line.len() >= 3 {
                    line[3..].trim()
                } else {
                    ""
                };

                let path = if let Some(idx) = path_raw.find(" -> ") {
                    &path_raw[idx + 4..]
                } else {
                    path_raw
                }.trim_matches('"').to_string();

                if x == '?' && y == '?' {
                    untracked.push(path);
                } else if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
                    conflicted.push(path);
                } else {
                    if x != ' ' && x != '?' {
                        staged.push(GitFileChange {
                            path: path.clone(),
                            status: x.to_string(),
                            staged: true,
                        });
                    }
                    if y != ' ' && y != '?' {
                        unstaged.push(GitFileChange {
                            path,
                            status: y.to_string(),
                            staged: false,
                        });
                    }
                }
            }
        }

        let is_clean = staged.is_empty() && unstaged.is_empty() && untracked.is_empty() && conflicted.is_empty();

        Ok(DetailedGitStatus {
            branch,
            is_clean,
            ahead,
            behind,
            staged,
            unstaged,
            untracked,
            conflicted,
        })
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_stage_path(path: String, cwd: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        if path == "." || path == "all" {
            cmd.args(["add", "-A"]);
        } else {
            cmd.args(["add", "--", &path]);
        }
        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git add failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_unstage_path(path: String, cwd: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        if path == "." || path == "all" {
            cmd.args(["restore", "--staged", "."]);
        } else {
            cmd.args(["restore", "--staged", "--", &path]);
        }
        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git restore --staged failed: {}", e))?;
        if !output.status.success() {
            let mut reset_cmd = Command::new("git");
            if path == "." || path == "all" {
                reset_cmd.args(["reset", "HEAD", "."]);
            } else {
                reset_cmd.args(["reset", "HEAD", "--", &path]);
            }
            reset_cmd.current_dir(&working_dir);
            let reset_out = reset_cmd.output().map_err(|e| format!("Git reset failed: {}", e))?;
            if !reset_out.status.success() {
                return Err(String::from_utf8_lossy(&reset_out.stderr).to_string());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_discard_path(path: String, is_untracked: bool, cwd: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        if is_untracked {
            let target_path = working_dir.join(&path);
            if target_path.is_dir() {
                fs::remove_dir_all(&target_path).map_err(|e| format!("Failed to delete untracked directory: {}", e))?;
            } else if target_path.exists() {
                fs::remove_file(&target_path).map_err(|e| format!("Failed to delete untracked file: {}", e))?;
            }
        } else {
            let output = Command::new("git")
                .args(["restore", "--worktree", "--", &path])
                .current_dir(&working_dir)
                .output()
                .map_err(|e| format!("Git restore failed: {}", e))?;
            if !output.status.success() {
                let fallback = Command::new("git")
                    .args(["checkout", "--", &path])
                    .current_dir(&working_dir)
                    .output()
                    .map_err(|e| format!("Git checkout failed: {}", e))?;
                if !fallback.status.success() {
                    return Err(String::from_utf8_lossy(&fallback.stderr).to_string());
                }
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_commit(message: String, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let output = Command::new("git")
            .args(["commit", "-m", &message])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Git commit failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_get_diff(staged_only: bool, path: Option<String>, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        cmd.arg("diff");
        if staged_only {
            cmd.arg("--cached");
        }
        if let Some(p) = path {
            if !p.trim().is_empty() {
                cmd.arg("--").arg(p);
            }
        }
        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git diff failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_get_branches(cwd: Option<String>) -> Result<Vec<GitBranchInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let output = Command::new("git")
            .args(["branch", "-a", "--format=%(refname:short)|%(HEAD)|%(objectname:short)|%(contents:subject)"])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Git branch failed: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let mut branches = Vec::new();
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.is_empty() || parts[0].trim().is_empty() {
                continue;
            }
            let name = parts[0].trim().to_string();
            let is_current = parts.get(1).map_or(false, |s| s.trim() == "*");
            let commit_hash = parts.get(2).map_or("", |s| s.trim()).to_string();
            let commit_message = parts.get(3).map_or("", |s| s.trim()).to_string();
            let is_remote = name.starts_with("origin/") || name.starts_with("remotes/");

            branches.push(GitBranchInfo {
                name,
                is_current,
                is_remote,
                commit_hash,
                commit_message,
            });
        }
        Ok(branches)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_checkout(branch: String, is_new: bool, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        cmd.arg("checkout");
        if is_new {
            cmd.arg("-b");
        }
        cmd.arg(&branch);
        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git checkout failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_delete_branch(branch: String, force: bool, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        cmd.arg("branch");
        if force {
            cmd.arg("-D");
        } else {
            cmd.arg("-d");
        }
        cmd.arg(&branch);
        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git delete branch failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(format!("Deleted branch {}", branch))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_get_log(limit: usize, cwd: Option<String>) -> Result<Vec<GitCommitInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let limit_str = limit.to_string();
        let output = Command::new("git")
            .args(["log", "-n", &limit_str, "--format=%H|%h|%an|%ae|%cr|%cd|%p|%s"])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Git log failed: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let mut commits = Vec::new();
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() < 8 {
                continue;
            }
            let hash = parts[0].to_string();
            let short_hash = parts[1].to_string();
            let author_name = parts[2].to_string();
            let author_email = parts[3].to_string();
            let relative_time = parts[4].to_string();
            let date = parts[5].to_string();
            let parents = parts[6].split_whitespace().map(|s| s.to_string()).collect();
            let message = parts[7].to_string();

            commits.push(GitCommitInfo {
                hash,
                short_hash,
                author_name,
                author_email,
                relative_time,
                date,
                message,
                parents,
            });
        }
        Ok(commits)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_get_stashes(cwd: Option<String>) -> Result<Vec<GitStashInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let output = Command::new("git")
            .args(["stash", "list", "--format=%gd|%gs|%cr"])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Git stash list failed: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let mut stashes = Vec::new();
        let stdout = String::from_utf8_lossy(&output.stdout);
        for (idx, line) in stdout.lines().enumerate() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.is_empty() {
                continue;
            }
            let name = parts[0].trim().to_string();
            let raw_msg = parts.get(1).map_or("", |s| s.trim());
            let relative_time = parts.get(2).map_or("", |s| s.trim()).to_string();

            let branch = if let Some(stripped) = raw_msg.strip_prefix("WIP on ") {
                stripped.split(':').next().unwrap_or("").trim().to_string()
            } else if let Some(stripped) = raw_msg.strip_prefix("On ") {
                stripped.split(':').next().unwrap_or("").trim().to_string()
            } else {
                "".to_string()
            };

            let message = if let Some(colon_pos) = raw_msg.find(": ") {
                raw_msg[colon_pos + 2..].to_string()
            } else {
                raw_msg.to_string()
            };

            stashes.push(GitStashInfo {
                index: idx,
                name,
                branch,
                message,
                relative_time,
            });
        }
        Ok(stashes)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_stash_op(op: String, message: Option<String>, index: Option<usize>, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let mut cmd = Command::new("git");
        cmd.arg("stash");

        match op.as_str() {
            "push" | "save" => {
                cmd.arg("push");
                if let Some(msg) = message {
                    if !msg.trim().is_empty() {
                        cmd.args(["-m", &msg]);
                    }
                }
            }
            "pop" => {
                cmd.arg("pop");
                if let Some(idx) = index {
                    cmd.arg(format!("stash@{{{}}}", idx));
                }
            }
            "apply" => {
                cmd.arg("apply");
                if let Some(idx) = index {
                    cmd.arg(format!("stash@{{{}}}", idx));
                }
            }
            "drop" => {
                cmd.arg("drop");
                if let Some(idx) = index {
                    cmd.arg(format!("stash@{{{}}}", idx));
                }
            }
            "clear" => {
                cmd.arg("clear");
            }
            _ => return Err(format!("Unknown stash operation '{}'", op)),
        }

        cmd.current_dir(&working_dir);
        let output = cmd.output().map_err(|e| format!("Git stash failed: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_get_blame_line(file_path: String, line: usize, cwd: Option<String>) -> Result<Option<GitBlameInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        let line_spec = format!("{},{}", line, line);
        let output = Command::new("git")
            .args(["blame", "-L", &line_spec, "--porcelain", "--", &file_path])
            .current_dir(&working_dir)
            .output();

        let out = match output {
            Ok(o) if o.status.success() => o,
            _ => return Ok(None),
        };

        let stdout = String::from_utf8_lossy(&out.stdout);
        let lines: Vec<&str> = stdout.lines().collect();
        if lines.is_empty() {
            return Ok(None);
        }

        let first_line_parts: Vec<&str> = lines[0].split_whitespace().collect();
        let commit_hash = first_line_parts.get(0).map_or("", |s| *s).to_string();

        let mut author_name = String::new();
        let mut author_email = String::new();
        let mut author_time_ts: i64 = 0;
        let mut summary = String::new();
        let mut line_content = String::new();

        for l in lines.iter().skip(1) {
            if let Some(rest) = l.strip_prefix("author ") {
                author_name = rest.trim().to_string();
            } else if let Some(rest) = l.strip_prefix("author-mail ") {
                author_email = rest.trim().trim_matches(|c| c == '<' || c == '>').to_string();
            } else if let Some(rest) = l.strip_prefix("author-time ") {
                author_time_ts = rest.trim().parse::<i64>().unwrap_or(0);
            } else if let Some(rest) = l.strip_prefix("summary ") {
                summary = rest.trim().to_string();
            } else if let Some(rest) = l.strip_prefix('\t') {
                line_content = rest.to_string();
            }
        }

        let relative_time = if author_time_ts > 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(author_time_ts);
            let diff = now.saturating_sub(author_time_ts);
            if diff < 60 {
                "just now".to_string()
            } else if diff < 3600 {
                format!("{}m ago", diff / 60)
            } else if diff < 86400 {
                format!("{}h ago", diff / 3600)
            } else if diff < 2592000 {
                format!("{}d ago", diff / 86400)
            } else if diff < 31536000 {
                format!("{}mo ago", diff / 2592000)
            } else {
                format!("{}y ago", diff / 31536000)
            }
        } else {
            "recently".to_string()
        };

        let short_hash = if commit_hash.len() >= 7 {
            commit_hash[..7].to_string()
        } else {
            commit_hash.clone()
        };

        Ok(Some(GitBlameInfo {
            commit_hash: short_hash,
            author_name,
            author_email,
            relative_time,
            line_number: line,
            line_content,
            summary,
        }))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn git_sync_remote(op: String, cwd: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let working_dir = get_working_dir(cwd);
        match op.as_str() {
            "pull" => {
                let out = Command::new("git").arg("pull").current_dir(&working_dir).output()
                    .map_err(|e| format!("Git pull failed: {}", e))?;
                if !out.status.success() {
                    return Err(String::from_utf8_lossy(&out.stderr).to_string());
                }
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            }
            "push" => {
                let out = Command::new("git").arg("push").current_dir(&working_dir).output()
                    .map_err(|e| format!("Git push failed: {}", e))?;
                if !out.status.success() {
                    return Err(String::from_utf8_lossy(&out.stderr).to_string());
                }
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            }
            "fetch" => {
                let out = Command::new("git").arg("fetch").current_dir(&working_dir).output()
                    .map_err(|e| format!("Git fetch failed: {}", e))?;
                if !out.status.success() {
                    return Err(String::from_utf8_lossy(&out.stderr).to_string());
                }
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            }
            "sync" => {
                let _ = Command::new("git").arg("pull").current_dir(&working_dir).output();
                let push_out = Command::new("git").arg("push").current_dir(&working_dir).output()
                    .map_err(|e| format!("Git push failed: {}", e))?;
                if !push_out.status.success() {
                    return Err(String::from_utf8_lossy(&push_out.stderr).to_string());
                }
                Ok("Repository synced successfully".to_string())
            }
            _ => Err(format!("Unknown sync operation '{}'", op)),
        }
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[command]
async fn search_workspace_files(
    query: String,
    root_path: Option<String>,
    is_regex: bool,
    match_case: bool,
    match_word: bool,
) -> Result<Vec<SearchResultEntry>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let root = match root_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let regex_pattern = if is_regex {
        let pattern = if match_word {
            format!(r"\b{}\b", query)
        } else {
            query.clone()
        };
        if match_case {
            regex::Regex::new(&pattern).map_err(|e| e.to_string())?
        } else {
            regex::RegexBuilder::new(&pattern)
                .case_insensitive(true)
                .build()
                .map_err(|e| e.to_string())?
        }
    } else {
        let escaped = regex::escape(&query);
        let pattern = if match_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        };
        if match_case {
            regex::Regex::new(&pattern).map_err(|e| e.to_string())?
        } else {
            regex::RegexBuilder::new(&pattern)
                .case_insensitive(true)
                .build()
                .map_err(|e| e.to_string())?
        }
    };

    let mut results: Vec<SearchResultEntry> = Vec::new();

    fn walk_search(
        dir: &Path,
        re: &regex::Regex,
        results: &mut Vec<SearchResultEntry>,
        depth: usize,
    ) {
        if depth > 12 || results.len() >= 200 {
            return;
        }

        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if should_ignore_name(&file_name) {
                continue;
            }

            let path = entry.path();
            if path.is_dir() {
                walk_search(&path, re, results, depth + 1);
            } else if path.is_file() {
                // Skip binary or huge files (> 1MB)
                if let Ok(meta) = entry.metadata() {
                    if meta.len() > 1_000_000 {
                        continue;
                    }
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    let mut file_matches = Vec::new();
                    for (line_idx, line) in content.lines().enumerate() {
                        for mat in re.find_iter(line) {
                            file_matches.push(SearchResultMatch {
                                line_number: line_idx + 1,
                                line_content: line.to_string(),
                                match_start: mat.start(),
                                match_end: mat.end(),
                            });
                            if file_matches.len() >= 50 {
                                break;
                            }
                        }
                    }

                    if !file_matches.is_empty() {
                        results.push(SearchResultEntry {
                            path: path.to_string_lossy().to_string(),
                            file_name,
                            matches: file_matches,
                        });
                    }
                }
            }
        }
    }

    walk_search(&root, &regex_pattern, &mut results, 0);

    Ok(results)
}

#[command]
async fn get_current_workspace_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[command]
async fn query_llm(
    prompt: String,
    code_context: Option<String>,
    file_path: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let key = match api_key {
        Some(k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => std::env::var("VITE_GEMINI_API_KEY")
            .or_else(|_| std::env::var("GEMINI_API_KEY"))
            .map_err(|_| {
                "No Gemini API key found. Please provide a key in Settings -> Custom API Key Vault or set VITE_GEMINI_API_KEY in your .env file.".to_string()
            })?,
    };

    let selected_model = model.unwrap_or_else(|| "gemini-3.6-flash".to_string());
    let file_str = file_path.unwrap_or_else(|| "untitled".to_string());
    let code_str = code_context.unwrap_or_default();

    let user_message = if !code_str.trim().is_empty() {
        format!(
            "You are Vortex, an elite AI desktop code editor pair programmer. Respond with concise, production-ready code. Whenever providing code, always wrap it in fenced markdown code blocks with the language identifier.\n\nFile: {}\nActive Code Context:\n```\n{}\n```\nRequest: {}",
            file_str, code_str, prompt
        )
    } else {
        format!(
            "You are Vortex, an elite AI desktop code editor pair programmer. Respond with concise, production-ready code. Whenever providing code, always wrap it in fenced markdown code blocks with the language identifier.\n\nRequest: {}",
            prompt
        )
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        selected_model, key
    );

    let res = client
        .post(&url)
        .json(&json!({
            "contents": [{
                "parts": [{
                    "text": user_message
                }]
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = res.status();
    let json_response: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    if !status.is_success() {
        let error_msg = json_response["error"]["message"]
            .as_str()
            .unwrap_or("Unknown API error");
        return Err(format!("API Error ({}): {}", status, error_msg));
    }

    let answer = json_response["candidates"]
        .get(0)
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("No response generated from model.")
        .to_string();

    Ok(answer)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            query_llm,
            read_dir_tree,
            read_file_content,
            write_file_content,
            create_file,
            create_directory,
            delete_entry,
            rename_entry,
            execute_shell_command,
            get_git_status,
            get_detailed_git_status,
            git_stage_path,
            git_unstage_path,
            git_discard_path,
            git_commit,
            git_get_diff,
            git_get_branches,
            git_checkout,
            git_delete_branch,
            git_get_log,
            git_get_stashes,
            git_stash_op,
            git_get_blame_line,
            git_sync_remote,
            search_workspace_files,
            get_current_workspace_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}