import { useState, useRef } from 'react'
import { Download, Upload, Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, DownloadCloud } from 'lucide-react'
import { generateConfigFile } from '../../utils/configGenerator.js'

const BackupManager = ({ config, showMessage }) => {
  const [webdavConfig, setWebdavConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('webdav_config')
      return saved ? JSON.parse(saved) : { url: '', username: '', password: '', autoBackup: false }
    } catch {
      return { url: '', username: '', password: '', autoBackup: false }
    }
  })
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isCloudRestoring, setIsCloudRestoring] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showRestoreFinalConfirm, setShowRestoreFinalConfirm] = useState(false)
  const [cloudBackupFiles, setCloudBackupFiles] = useState([])
  const [selectedBackupFile, setSelectedBackupFile] = useState('')
  const [lastBackupTime, setLastBackupTime] = useState(() => localStorage.getItem('last_backup_time') || '')
  const fileInputRef = useRef(null)

  const handleExport = () => {
    try {
      const currentSiteConfig = JSON.parse(localStorage.getItem('siteConfig') || '{}')
      const configContent = generateConfigFile(config.websiteData, config.categories, currentSiteConfig)
      const blob = new Blob([configContent], { type: 'text/javascript;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `binnav-backup-${new Date().toISOString().slice(0, 10)}.js`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showMessage('success', '数据导出成功')
    } catch (error) {
      showMessage('error', `导出失败: ${error.message}`)
    }
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsRestoring(true)
    try {
      const text = await file.text()

      const siteConfigMatch = text.match(/export const siteConfig\s*=\s*({[\s\S]*?});/)
      const websiteDataMatch = text.match(/export const websiteData\s*=\s*(\[[\s\S]*?\]);/)
      const categoriesMatch = text.match(/export const categories\s*=\s*(\[[\s\S]*?\]);/)

      if (!websiteDataMatch || !categoriesMatch) {
        throw new Error('文件格式不正确，请选择有效的备份文件')
      }

      const websiteData = JSON.parse(websiteDataMatch[1])
      const categories = JSON.parse(categoriesMatch[1])

      if (siteConfigMatch) {
        const siteConfig = JSON.parse(siteConfigMatch[1])
        localStorage.setItem('siteConfig', JSON.stringify(siteConfig))
      }

      localStorage.setItem('imported_websiteData', JSON.stringify(websiteData))
      localStorage.setItem('imported_categories', JSON.stringify(categories))

      showMessage('success', '数据导入成功！请点击右上角"保存设置"将数据同步到远程仓库，然后刷新页面。')
    } catch (error) {
      showMessage('error', `导入失败: ${error.message}`)
    } finally {
      setIsRestoring(false)
      e.target.value = ''
    }
  }

  const saveWebdavConfig = () => {
    try {
      localStorage.setItem('webdav_config', JSON.stringify(webdavConfig))
      showMessage('success', 'WebDAV配置已保存')
    } catch (error) {
      showMessage('error', `保存失败: ${error.message}`)
    }
  }

  const testWebdavConnection = async () => {
    if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
      showMessage('error', '请填写完整的WebDAV配置')
      return
    }

    try {
      const response = await fetch('/api/webdav-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password
        })
      })

      const result = await response.json()
      if (result.success) {
        showMessage('success', 'WebDAV连接测试成功')
      } else {
        showMessage('error', result.message || '连接失败')
      }
    } catch (error) {
      showMessage('error', `连接测试失败: ${error.message}`)
    }
  }

  const backupToWebdav = async () => {
    if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
      showMessage('error', '请先配置WebDAV信息')
      return
    }

    setIsBackingUp(true)
    try {
      const currentSiteConfig = JSON.parse(localStorage.getItem('siteConfig') || '{}')
      const configContent = generateConfigFile(config.websiteData, config.categories, currentSiteConfig)

      const filename = `binnav-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.js`

      const response = await fetch('/api/webdav-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password,
          content: configContent,
          filename
        })
      })

      const result = await response.json()
      if (result.success) {
        const now = new Date().toLocaleString('zh-CN')
        setLastBackupTime(now)
        localStorage.setItem('last_backup_time', now)
        showMessage('success', `备份成功: ${filename}`)
      } else {
        throw new Error(result.message || '上传失败')
      }
    } catch (error) {
      showMessage('error', `备份失败: ${error.message}`)
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleCloudRestoreClick = async () => {
    if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
      showMessage('error', '请先配置WebDAV信息')
      return
    }

    try {
      const response = await fetch('/api/webdav-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password
        })
      })

      const result = await response.json()
      if (result.success && result.files.length > 0) {
        setCloudBackupFiles(result.files)
        setSelectedBackupFile(result.files[0])
        setShowRestoreConfirm(true)
      } else if (result.success && result.files.length === 0) {
        showMessage('error', '云端没有找到备份文件')
      } else {
        showMessage('error', result.message || '获取备份列表失败')
      }
    } catch (error) {
      showMessage('error', `获取备份列表失败: ${error.message}`)
    }
  }

  const handleRestoreFirstConfirm = () => {
    setShowRestoreConfirm(false)
    setShowRestoreFinalConfirm(true)
  }

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false)
    setShowRestoreFinalConfirm(false)
    setSelectedBackupFile('')
    setCloudBackupFiles([])
  }

  const handleCloudRestore = async () => {
    setShowRestoreFinalConfirm(false)
    setIsCloudRestoring(true)

    try {
      const response = await fetch('/api/webdav-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password,
          filename: selectedBackupFile
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || '下载失败')
      }

      const text = result.content

      const siteConfigMatch = text.match(/export const siteConfig\s*=\s*({[\s\S]*?});/)
      const websiteDataMatch = text.match(/export const websiteData\s*=\s*(\[[\s\S]*?\]);/)
      const categoriesMatch = text.match(/export const categories\s*=\s*(\[[\s\S]*?\]);/)

      if (!websiteDataMatch || !categoriesMatch) {
        throw new Error('备份文件格式不正确，无法解析数据')
      }

      const websiteData = JSON.parse(websiteDataMatch[1])
      const categories = JSON.parse(categoriesMatch[1])

      if (siteConfigMatch) {
        const siteConfig = JSON.parse(siteConfigMatch[1])
        localStorage.setItem('siteConfig', JSON.stringify(siteConfig))
      }

      localStorage.setItem('imported_websiteData', JSON.stringify(websiteData))
      localStorage.setItem('imported_categories', JSON.stringify(categories))

      showMessage('success', `云端恢复成功（${selectedBackupFile}）！请点击右上角"保存设置"将数据同步到远程仓库，然后刷新页面。`)
    } catch (error) {
      showMessage('error', `云端恢复失败: ${error.message}`)
    } finally {
      setIsCloudRestoring(false)
      setSelectedBackupFile('')
      setCloudBackupFiles([])
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">数据备份</h3>

      {/* 本地导入导出 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-base font-medium text-gray-900 mb-4">本地导入导出</h4>
        <p className="text-sm text-gray-600 mb-4">将站点数据导出为文件备份，或从备份文件中恢复数据</p>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            <span>导出数据</span>
          </button>

          <button
            onClick={handleImport}
            disabled={isRestoring}
            className="flex items-center space-x-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            <span>{isRestoring ? '导入中...' : '导入数据'}</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".js"
          onChange={handleFileSelect}
          className="hidden"
        />

        <p className="text-xs text-gray-500 mt-3">
          支持导入通过本系统导出的 .js 备份文件
        </p>
      </div>

      {/* WebDAV 云备份 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-medium text-gray-900">WebDAV 云备份</h4>
            <p className="text-sm text-gray-600 mt-1">接入坚果云等 WebDAV 服务，实现数据云端备份</p>
          </div>
          {lastBackupTime && (
            <div className="flex items-center text-xs text-green-600">
              <CheckCircle size={14} className="mr-1" />
              <span>上次备份: {lastBackupTime}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WebDAV 地址</label>
            <input
              type="url"
              value={webdavConfig.url}
              onChange={(e) => setWebdavConfig({ ...webdavConfig, url: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="https://dav.jianguoyun.com/dav/BinNav_Backup/"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={webdavConfig.username}
              onChange={(e) => setWebdavConfig({ ...webdavConfig, username: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 / 应用密码</label>
            <input
              type="password"
              value={webdavConfig.password}
              onChange={(e) => setWebdavConfig({ ...webdavConfig, password: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="坚果云请使用应用密码"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={webdavConfig.autoBackup}
                onChange={(e) => setWebdavConfig({ ...webdavConfig, autoBackup: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">保存配置时自动备份</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={saveWebdavConfig}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <CheckCircle size={14} />
            <span>保存配置</span>
          </button>
          <button
            onClick={testWebdavConnection}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            <span>测试连接</span>
          </button>
          <button
            onClick={backupToWebdav}
            disabled={isBackingUp}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
          >
            <Cloud size={14} />
            <span>{isBackingUp ? '备份中...' : '立即备份到云端'}</span>
          </button>
          <button
            onClick={handleCloudRestoreClick}
            disabled={isCloudRestoring}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:opacity-50"
          >
            <DownloadCloud size={14} />
            <span>{isCloudRestoring ? '恢复中...' : '从云端恢复'}</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">坚果云 WebDAV 配置说明：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>地址格式：https://dav.jianguoyun.com/dav/你的文件夹名/</li>
                <li>用户名：坚果云登录邮箱</li>
                <li>密码：坚果云 → 设置 → 安全选项 → 第三方应用管理 → 添加应用密码</li>
                <li>开启"保存配置时自动备份"后，每次点击"保存设置"都会自动同步到云端</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 第一步确认弹窗：选择备份文件 */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">从云端恢复数据</h4>
            <p className="text-sm text-gray-600 mb-4">
              云端共找到 <span className="font-medium text-blue-600">{cloudBackupFiles.length}</span> 个备份文件，请选择要恢复的版本：
            </p>

            <select
              value={selectedBackupFile}
              onChange={(e) => setSelectedBackupFile(e.target.value)}
              size={Math.min(cloudBackupFiles.length, 8)}
              className="w-full p-2.5 border border-gray-300 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            >
              {cloudBackupFiles.map((file) => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>

            <p className="text-xs text-gray-500 mb-4">
              文件按时间倒序排列，最新备份在最上方
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRestoreCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRestoreFirstConfirm}
                className="px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 第二步确认弹窗：二次确认 */}
      {showRestoreFinalConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center space-x-2 mb-3">
              <AlertCircle size={20} className="text-red-600" />
              <h4 className="text-lg font-semibold text-red-600">危险操作确认</h4>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              您即将从云端恢复备份文件：
            </p>
            <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-3 break-all">
              {selectedBackupFile}
            </p>
            <p className="text-sm text-red-600 font-medium mb-4">
              此操作将覆盖当前所有站点数据，且不可撤销！请确认您已了解风险。
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRestoreCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCloudRestore}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BackupManager
