import { useState, useRef } from 'react'
import { Download, Upload, Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
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
    </div>
  )
}

export default BackupManager
