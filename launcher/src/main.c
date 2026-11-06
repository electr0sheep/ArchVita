#include <psp2/appmgr.h>
#include <psp2/io/fcntl.h>
#include <psp2/io/stat.h>
#include <psp2/kernel/processmgr.h>
#include <psp2/kernel/threadmgr.h>
#include <stdio.h>
#include <string.h>

#define LAUNCH_FILE "app0:/launch.txt"
#define LOG_DIR "ux0:data/ArchVita"
#define LOG_FILE LOG_DIR "/launcher.log"

static int read_uri(char *buf, int size) {
  SceUID fd = sceIoOpen(LAUNCH_FILE, SCE_O_RDONLY, 0777);
  if (fd < 0)
    return fd;
  int len = sceIoRead(fd, buf, size - 1);
  sceIoClose(fd);
  if (len < 0)
    return len;
  buf[len] = '\0';
  while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r' || buf[len - 1] == ' ' || buf[len - 1] == '\t'))
    buf[--len] = '\0';
  return len;
}

static void log_failure(const char *uri, int res) {
  sceIoMkdir(LOG_DIR, 0777);
  SceUID fd = sceIoOpen(LOG_FILE, SCE_O_WRONLY | SCE_O_CREAT | SCE_O_APPEND, 0777);
  if (fd < 0)
    return;
  char line[1200];
  int n = snprintf(line, sizeof(line), "launch failed 0x%08X: %s\n", res, uri);
  sceIoWrite(fd, line, n);
  sceIoClose(fd);
}

int main(void) {
  char uri[1024];
  int len = read_uri(uri, sizeof(uri));

  if (len > 0) {
    int res = -1;
    for (int attempt = 0; attempt < 3 && res < 0; attempt++) {
      sceKernelDelayThread(10000);
      res = sceAppMgrLaunchAppByUri(0x20000, uri);
    }
    if (res < 0)
      log_failure(uri, res);
  } else {
    log_failure("launch.txt missing or empty", len);
  }

  sceKernelExitProcess(0);
  return 0;
}
