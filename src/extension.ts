import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  const rPackageProvider = new rpmViewProvider();
  vscode.window.registerTreeDataProvider("rpmView", rPackageProvider);

  let showWebviewCommand = vscode.commands.registerCommand(
    "rpm.showWebview",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "rpm",
        "Hello World",
        vscode.ViewColumn.One,
        {}
      );

      panel.webview.html = getWebviewContent("");
    }
  );

  let refreshCommand = vscode.commands.registerCommand(
    "rpm.showOldPackages",
    async () => {
      const result = await updatePackages();
      vscode.window.showInformationMessage(result); // 결과 메시지 표시
    }
  );

  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(showWebviewCommand);
}

function getWebviewContent(oldPackages: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Old Packages</title>
  </head>
  <body>
      <h1>Old Packages</h1>
      <pre>${oldPackages}</pre> 
  </body>
  </html>`;
}

async function updatePackages(): Promise<string> {
  try {
    const { stdout } = await execPromise(
      'Rscript -e "op <- old.packages(repos = \\"https://cloud.r-project.org/\\")[1:5, 1]; for(pkg in op){ cat(pkg); install.packages(pkg, repos = \\"https://cloud.r-project.org/\\", quiet = TRUE); }"'
    );
    return stdout;
  } catch (error) {
    console.error("Error fetching R packages:", error);
    return "ERROR";
  }
}

async function getInstalledRPackages(): Promise<string[]> {
  try {
    const { stdout } = await execPromise(
      "Rscript -e \"ip <- installed.packages(fields = 'Title')[, c(1, 3, 17)]; colnames(ip) <- NULL; ip <- apply(ip, 1, function(x) paste(x, collapse='\\t')); cat(ip, sep='\\n'); \""
    );
    return stdout.split("\n");
  } catch (error) {
    console.error("Error fetching R packages:", error);
    return [];
  }
}

class RPackageItem extends vscode.TreeItem {
  constructor(name: string, version: string, title: string) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = `${version} ${title}`;
  }
}

class rpmViewProvider implements vscode.TreeDataProvider<RPackageItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RPackageItem | undefined> =
    new vscode.EventEmitter<RPackageItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<RPackageItem | undefined> =
    this._onDidChangeTreeData.event;

  async getChildren(element?: RPackageItem): Promise<RPackageItem[]> {
    const packages = await getInstalledRPackages();

    return packages
      .map((pkgInfo) => {
        const parts = pkgInfo.split("\t");

        if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
          console.error("Invalid package info:", pkgInfo);
          return null; // 유효하지 않은 경우 null 반환
        }

        const name = parts[0];
        const version = parts[1];
        const title = parts[2];

        return new RPackageItem(name, version, title);
      })
      .filter((item) => item !== null);
  }

  getTreeItem(element: RPackageItem): vscode.TreeItem {
    return element;
  }
}
