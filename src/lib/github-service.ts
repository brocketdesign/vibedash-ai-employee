// ============================================================
// VibeDash — GitHub API Integration
// ============================================================

import { GitHubRepo } from "@/types";
import { getAppUrl } from "@/lib/utils";
import { connectToDatabase } from "@/lib/mongodb";

// GitHub API configuration
const GITHUB_API_BASE = "https://api.github.com";

// OAuth scope required to read PRIVATE repositories. The "repo" scope grants
// read/write to private repos; we only ever read. Public-only would be "public_repo".
const GITHUB_OAUTH_SCOPE = "repo";

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  diff?: string;
}

interface FileContent {
  path: string;
  content: string;
  type: "file" | "directory";
}

// Parse GitHub repo URL to get owner and repo name
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "").replace(/\/$/, "") };
}

// Fetch repository information
export async function fetchRepoInfo(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<GitHubRepo | null> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      html_url: data.html_url,
      language: data.language,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
      topics: data.topics || [],
    };
  } catch (error) {
    console.error("Failed to fetch repo info:", error);
    return null;
  }
}

// Fetch recent commits
export async function fetchRecentCommits(
  owner: string,
  repo: string,
  limit: number = 10,
  accessToken?: string
): Promise<CommitInfo[]> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=${limit}`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const commits = await response.json();
    
    return commits.map((commit: {
      sha: string;
      commit: {
        message: string;
        author: { name: string; date: string };
      };
    }) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
    }));
  } catch (error) {
    console.error("Failed to fetch commits:", error);
    return [];
  }
}

// Fetch commit diff (simplified - gets files changed)
export async function fetchCommitDiff(
  owner: string,
  repo: string,
  sha: string,
  accessToken?: string
): Promise<string> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract file changes summary
    const files = data.files || [];
    const summary = files.slice(0, 5).map((file: { filename: string; status: string }) => 
      `${file.status}: ${file.filename}`
    ).join("\n");
    
    return summary;
  } catch (error) {
    console.error("Failed to fetch commit diff:", error);
    return "";
  }
}

// Fetch repository contents
export async function fetchRepoContents(
  owner: string,
  repo: string,
  path: string = "",
  accessToken?: string
): Promise<FileContent[]> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    const contents: FileContent[] = [];
    
    for (const item of data) {
      if (item.type === "file" && item.download_url) {
        // Fetch file content for important files
        if (isImportantFile(item.name)) {
          try {
            const contentResponse = await fetch(item.download_url);
            const content = await contentResponse.text();
            contents.push({
              path: item.path,
              content: content.substring(0, 50000), // Limit size
              type: "file",
            });
          } catch {
            // Skip files we can't fetch
          }
        }
      } else if (item.type === "dir") {
        contents.push({
          path: item.path,
          content: "",
          type: "directory",
        });
      }
    }
    
    return contents;
  } catch (error) {
    console.error("Failed to fetch repo contents:", error);
    return [];
  }
}

// Check if a file is important for code review
function isImportantFile(filename: string): boolean {
  const importantExtensions = [
    ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
    ".java", ".kt", ".swift", ".php", ".cs", ".cpp", ".c",
    "package.json", "requirements.txt", "Gemfile",
    "README.md", "Dockerfile", "docker-compose.yml",
    ".env.example", "next.config", "tailwind.config",
  ];
  
  return importantExtensions.some(ext => 
    filename.toLowerCase().includes(ext.toLowerCase())
  );
}

// Fetch README content from a repository
export async function fetchReadme(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<string | null> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const readmeResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers }
    );

    if (readmeResponse.ok) {
      const readme = await readmeResponse.json();
      return Buffer.from(readme.content, "base64").toString();
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch README:", error);
    return null;
  }
}

// Fetch comprehensive repository analysis for AI review
export async function fetchKeyFiles(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<string> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    let content = "=== REPOSITORY ANALYSIS ===\n\n";
    
    // 1. Get repository info and stats
    const repoResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers }
    );
    
    if (repoResponse.ok) {
      const repoData = await repoResponse.json();
      content += `REPOSITORY OVERVIEW:\n`;
      content += `- Name: ${repoData.name}\n`;
      content += `- Description: ${repoData.description || "No description"}\n`;
      content += `- Primary Language: ${repoData.language || "Not specified"}\n`;
      content += `- Total Files: ${repoData.size}KB estimated\n`;
      content += `- Stars: ${repoData.stargazers_count}\n`;
      content += `- Open Issues: ${repoData.open_issues_count}\n`;
      content += `- Created: ${repoData.created_at}\n`;
      content += `- Last Updated: ${repoData.updated_at}\n\n`;
    }
    
    // 2. Get README
    const readmeResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers }
    );
    
    if (readmeResponse.ok) {
      const readme = await readmeResponse.json();
      content += `README:\n${Buffer.from(readme.content, "base64").toString()}\n\n`;
    }
    
    // 3. Get full repository tree structure
    const branches = ["main", "master"];
    let treeData = null;
    
    for (const branch of branches) {
      const treeResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );
      
      if (treeResponse.ok) {
        treeData = await treeResponse.json();
        content += `BRANCH: ${branch}\n\n`;
        break;
      }
    }
    
    if (!treeData) {
      return content;
    }
    
    // 4. Analyze file structure
    const allFiles = treeData.tree.filter((item: { type: string }) => item.type === "blob");
    const allDirs = treeData.tree.filter((item: { type: string }) => item.type === "tree");
    
    content += `=== FILE STRUCTURE ANALYSIS ===\n`;
    content += `- Total Files: ${allFiles.length}\n`;
    content += `- Total Directories: ${allDirs.length}\n\n`;
    
    // 5. Analyze file types and counts
    const fileStats: Record<string, number> = {};
    const directoryStructure: Record<string, string[]> = {};
    
    allFiles.forEach((file: { path: string }) => {
      const ext = file.path.split(".").pop()?.toLowerCase() || "no-extension";
      fileStats[ext] = (fileStats[ext] || 0) + 1;
      
      // Track directory structure
      const dir = file.path.split("/").slice(0, -1).join("/") || "root";
      if (!directoryStructure[dir]) {
        directoryStructure[dir] = [];
      }
      directoryStructure[dir].push(file.path.split("/").pop() || "");
    });
    
    content += `FILE TYPE BREAKDOWN:\n`;
    Object.entries(fileStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([ext, count]) => {
        content += `- .${ext}: ${count} files\n`;
      });
    content += `\n`;
    
    // 6. Directory structure (top-level and important dirs)
    content += `DIRECTORY STRUCTURE:\n`;
    Object.entries(directoryStructure)
      .filter(([dir]) => dir === "root" || !dir.includes("/"))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([dir, files]) => {
        content += `- ${dir}/ (${files.length} files)\n`;
      });
    content += `\n`;
    
    // 7. Get recent commits for activity analysis
    let commits: Array<{ commit: { message: string } }> = [];
    const commitsResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=20`,
      { headers }
    );
    
    if (commitsResponse.ok) {
      commits = await commitsResponse.json();
      content += `=== RECENT COMMIT ACTIVITY ===\n`;
      content += `- Recent commits: ${commits.length}\n\n`;
      content += `COMMIT MESSAGES (last 15):\n`;
      commits.slice(0, 15).forEach((commit, i) => {
        content += `${i + 1}. ${commit.commit.message.split("\n")[0]}\n`;
      });
      content += `\n`;
    }
    
    // 8. Fetch key configuration and architecture files
    const keyFilesToFetch = [
      "package.json",
      "requirements.txt",
      "Gemfile",
      "Dockerfile",
      "docker-compose.yml",
      "next.config.js",
      "next.config.ts",
      "tailwind.config.js",
      "tailwind.config.ts",
      "tsconfig.json",
      ".env.example",
      "README.md",
    ];
    
    content += `=== CONFIGURATION FILES ===\n`;
    for (const fileName of keyFilesToFetch) {
      try {
        const fileResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${fileName}`,
          { headers }
        );
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          const fileContent = Buffer.from(fileData.content, "base64").toString();
          content += `\n--- ${fileName} ---\n${fileContent.substring(0, 3000)}\n`;
        }
      } catch {
        // File doesn't exist, skip
      }
    }
    
    // 9. Fetch representative source files from different directories
    content += `\n=== SOURCE CODE SAMPLES ===\n`;
    content += `(Showing representative files from different parts of the codebase)\n\n`;
    
    // Group files by directory and fetch representative samples
    const filesByDir: Record<string, Array<{ path: string; name: string }>> = {};
    allFiles.forEach((file: { path: string }) => {
      const dir = file.path.split("/").slice(0, 2).join("/");
      if (!filesByDir[dir]) {
        filesByDir[dir] = [];
      }
      filesByDir[dir].push({
        path: file.path,
        name: file.path.split("/").pop() || ""
      });
    });
    
    // Fetch 1-2 representative files from each major directory
    let filesFetched = 0;
    const maxFilesToFetch = 8;
    
    Object.entries(filesByDir)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([dir, files]) => {
        if (filesFetched >= maxFilesToFetch) return;
        
        // Pick the first reasonable file from this directory
        const representativeFile = files.find(f => {
          const ext = f.name.split(".").pop()?.toLowerCase();
          return ["ts", "tsx", "js", "jsx", "py", "rb", "go"].includes(ext || "");
        }) || files[0];
        
        if (representativeFile) {
          try {
            const fileResponse = fetch(
              `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${representativeFile.path}`,
              { headers }
            );
            
            // Use a timeout to avoid hanging on too many requests
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Timeout")), 5000)
            );
            
            Promise.race([fileResponse, timeoutPromise])
              .then(async (response) => {
                if (response && response instanceof Response && response.ok) {
                  const fileData = await response.json();
                  const fileContent = Buffer.from(fileData.content, "base64").toString();
                  content += `\n--- ${representativeFile.path} ---\n`;
                  content += `// File from: ${dir}/\n`;
                  content += `${fileContent.substring(0, 2000)}\n`;
                }
              })
              .catch(() => {
                // Skip if timeout or error
              });
            
            filesFetched++;
          } catch {
            // Continue
          }
        }
      });
    
    // 10. Summary of what's been analyzed
    content += `\n=== ANALYSIS SUMMARY ===\n`;
    content += `- Repository structure: ${allDirs.length} directories, ${allFiles.length} files\n`;
    content += `- Primary file types analyzed: ${Object.keys(fileStats).slice(0, 5).join(", ")}\n`;
    content += `- Recent activity: ${commits.length} commits analyzed\n`;
    content += `- Config files examined: ${keyFilesToFetch.length} types\n`;
    content += `- Source samples: ${filesFetched} representative files\n`;
    content += `\n`;
    
    return content;
  } catch (error) {
    console.error("Failed to fetch key files:", error);
    return "";
  }
}

// Fetch total commit count for a repository (lightweight, uses Link header)
export async function fetchTotalCommitCount(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<number> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=1`,
      { headers }
    );

    if (!response.ok) return 0;

    const linkHeader = response.headers.get("link");
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
      if (lastMatch) {
        return parseInt(lastMatch[1], 10);
      }
    }

    // If no Link header, there's only one page (<=1 commit)
    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    console.error("Failed to fetch commit count:", error);
    return 0;
  }
}

// Lightweight GitHub stats sync — fetches repo info, commit count, and latest commit
// Does NOT require AI service
export async function syncGitHubStats(
  githubUrl: string,
  accessToken?: string
): Promise<{
  repo: GitHubRepo | null;
  totalCommits: number;
  lastCommit: CommitInfo | null;
} | null> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;

  try {
    const [repoInfo, totalCommits, recentCommits] = await Promise.all([
      fetchRepoInfo(owner, repo, accessToken),
      fetchTotalCommitCount(owner, repo, accessToken),
      fetchRecentCommits(owner, repo, 1, accessToken),
    ]);

    return {
      repo: repoInfo,
      totalCommits,
      lastCommit: recentCommits.length > 0 ? recentCommits[0] : null,
    };
  } catch (error) {
    console.error("GitHub stats sync failed:", error);
    return null;
  }
}

// Sync project with GitHub (fetch latest info)
export async function syncWithGitHub(
  githubUrl: string,
  accessToken?: string
): Promise<{
  repo: GitHubRepo | null;
  commits: CommitInfo[];
  code: string;
} | null> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) return null;
  
  const { owner, repo } = parsed;
  
  try {
    const [repoInfo, commits, code] = await Promise.all([
      fetchRepoInfo(owner, repo, accessToken),
      fetchRecentCommits(owner, repo, 5, accessToken),
      fetchKeyFiles(owner, repo, accessToken),
    ]);
    
    // Fetch diffs for recent commits
    const commitsWithDiffs = await Promise.all(
      commits.map(async (commit) => {
        const diff = await fetchCommitDiff(owner, repo, commit.sha, accessToken);
        return { ...commit, diff };
      })
    );
    
    return {
      repo: repoInfo,
      commits: commitsWithDiffs,
      code,
    };
  } catch (error) {
    console.error("GitHub sync failed:", error);
    return null;
  }
}

// Fetch the per-user GitHub OAuth token stored by the OAuth callback. Returns
// null when the user has never connected GitHub.
export async function getUserGitHubToken(userId: string): Promise<string | null> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection("github_tokens").findOne({ userId });
    return (doc?.accessToken as string) || null;
  } catch (error) {
    console.error("Failed to load user GitHub token:", error);
    return null;
  }
}

// Resolve the best available token for reading a project's repo: an explicit
// per-project token wins, otherwise fall back to the user's OAuth token.
export async function resolveGitHubToken(
  userId: string,
  projectToken?: string | null
): Promise<string | undefined> {
  if (projectToken) return projectToken;
  const userToken = await getUserGitHubToken(userId);
  return userToken || undefined;
}

// Redirect URI that GitHub sends the user back to after authorizing.
export function getGitHubRedirectUri(): string {
  return `${getAppUrl()}/api/github/callback`;
}

// Build the GitHub OAuth consent URL. `state` carries context (e.g. userId +
// projectId) so the callback knows who authorized and where to return them.
// Requests the "repo" scope so we can read PRIVATE repositories.
export function getGitHubAuthUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const params = new URLSearchParams({
    client_id: clientId || "",
    redirect_uri: getGitHubRedirectUri(),
    scope: GITHUB_OAUTH_SCOPE,
    state,
    allow_signup: "false",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// Result of probing whether the current credentials can read a repository.
export interface RepoAccessStatus {
  accessible: boolean;
  status: number; // HTTP status from GitHub (0 on network error)
  isPrivate: boolean | null; // null when we couldn't determine
}

// Probe whether a repository is reachable with the given token. GitHub returns
// 404 (not 403) for private repos when the caller lacks access, so we treat
// both 404 and 403 as "needs access".
export async function getRepoAccessStatus(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<RepoAccessStatus> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });

    if (response.ok) {
      const data = await response.json();
      return { accessible: true, status: response.status, isPrivate: !!data.private };
    }

    return { accessible: false, status: response.status, isPrivate: null };
  } catch (error) {
    console.error("Failed to probe repo access:", error);
    return { accessible: false, status: 0, isPrivate: null };
  }
}

// Exchange GitHub OAuth code for access token
export async function exchangeGitHubCode(code: string): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error("GitHub OAuth credentials not configured");
    return null;
  }
  
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getGitHubRedirectUri(),
      }),
    });
    
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("GitHub OAuth exchange failed:", error);
    return null;
  }
}
