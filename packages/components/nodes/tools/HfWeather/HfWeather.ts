import { INode } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { HfWeather } from './core'

class HfWeather_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    author: string
    baseClasses: string[]

    constructor() {
        this.label = 'HfWeather'
        this.name = 'hfWeather'
        this.version = 1.0
        this.type = 'HfWeather'
        this.icon = 'hfweather.svg'
        this.category = 'Tools'
        this.author = 'ikd_205c'
        this.description = '根据城市名称，获取指定城市天气'
        this.baseClasses = [this.type, ...getBaseClasses(HfWeather)]
    }

    async init() {
        return new HfWeather()
    }
}

module.exports = { nodeClass: HfWeather_Tools }
