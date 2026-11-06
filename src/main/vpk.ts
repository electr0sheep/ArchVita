import AdmZip from 'adm-zip'

export async function folderToVpk(folder: string, vpkPath: string): Promise<void> {
  const zip = new AdmZip()
  zip.addLocalFolder(folder)
  await zip.writeZipPromise(vpkPath)
}
