import React from 'react'
import { Card, CardContent } from './ui/card'
import { useSiteConfig } from '../hooks/useSiteConfig'

const WebsiteCard = ({ website }) => {
  const { siteConfig } = useSiteConfig()
  const fallbackIcon = siteConfig.customIconUrl || siteConfig.siteLogo || '/assets/logo.png'

  const getIconUrl = () => {
    if (website.icon) {
      return website.icon
    }

    try {
      const hostname = new URL(website.url).hostname
      return `https://icon.nbvil.com/favicon?url=${hostname}`
    } catch (error) {
      return fallbackIcon
    }
  }

  const handleIconError = (e) => {
    e.target.src = fallbackIcon
    e.target.onerror = null
  }

  return (
    <Card
      className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden h-24 hover:h-auto w-full"
      onClick={() => window.open(website.url, '_blank')}
    >
      <CardContent className="h-full p-4 flex items-center justify-start">
        <div className="flex items-center space-x-3 w-full">
          <div className="flex-shrink-0">
            <img
              src={getIconUrl()}
              alt={website.name}
              className="w-8 h-8 rounded-md shadow-sm bg-gray-100 p-0.5"
              onError={handleIconError}
              style={{
                display: 'block',
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                flexShrink: 0
              }}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {website.name}
              </h3>
              {website.category === 'author' && website.featured && (
                <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                  作者
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate group-hover:whitespace-normal group-hover:line-clamp-none transition-all duration-300 leading-tight mb-1">
              {website.description}
            </p>
            <div className="flex gap-1 overflow-hidden">
              <div className="flex gap-1 group-hover:flex-wrap">
                {website.tags && website.tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded whitespace-nowrap ${
                      index >= 2 ? 'hidden group-hover:inline-block' : ''
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default WebsiteCard 