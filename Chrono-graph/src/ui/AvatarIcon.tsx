import React, { useMemo } from 'react'

interface AvatarIconProps {
  name: string
  shirtColor?: string
  size?: number
  className?: string
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({
  name,
  shirtColor = '#00f0ff',
  size = 24,
  className = '',
}) => {
  const dataUrl = useMemo(() => {
    let seed = 0
    for (let i = 0; i < name.length; i++) {
      seed = (seed << 5) - seed + name.charCodeAt(i)
    }
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    const skinTones = ['#ffd1b3', '#fcd0a1', '#e0ac69', '#c68642', '#8d5524']
    const hairColors = [
      '#1a1105',
      '#4a2912',
      '#b55214',
      '#e6be8a',
      '#8a8a8a',
      '#00f0ff',
      '#ff0055',
      '#ffe600',
    ]
    const pantColors = ['#1e293b', '#1e3a8a', '#334155']

    const skin = skinTones[Math.floor(rand() * skinTones.length)]
    const hair = hairColors[Math.floor(rand() * hairColors.length)]
    const pants = pantColors[Math.floor(rand() * pantColors.length)]
    const shirt = shirtColor

    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.imageSmoothingEnabled = false

    // Hair
    ctx.fillStyle = hair
    ctx.fillRect(4, 2, 8, 4)
    ctx.fillRect(3, 4, 2, 4)
    ctx.fillRect(11, 4, 2, 4)

    // Skin
    ctx.fillStyle = skin
    ctx.fillRect(5, 4, 6, 4)
    ctx.fillRect(6, 8, 4, 1)

    // Eyes
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(6, 5, 1, 1)
    ctx.fillRect(9, 5, 1, 1)

    // Shirt
    ctx.fillStyle = shirt
    ctx.fillRect(5, 9, 6, 4)
    ctx.fillRect(3, 9, 2, 3)
    ctx.fillRect(11, 9, 2, 3)

    // Hands
    ctx.fillStyle = skin
    ctx.fillRect(3, 12, 2, 1)
    ctx.fillRect(11, 12, 2, 1)

    // Pants & Legs
    ctx.fillStyle = pants
    ctx.fillRect(5, 13, 6, 1)
    ctx.fillRect(5, 14, 2, 2)
    ctx.fillRect(9, 14, 2, 2)

    return canvas.toDataURL()
  }, [name, shirtColor])

  if (!dataUrl) return null

  return (
    <img
      src={dataUrl}
      alt={name}
      width={size}
      height={size}
      className={`select-none inline-block ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
