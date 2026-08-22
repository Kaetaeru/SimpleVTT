const os=require("node:os");

try {
  os.userInfo();
} catch {
  os.userInfo=()=>({uid:-1,gid:-1,username:"codex",homedir:process.cwd(),shell:null});
}
