import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { BaseOutputParser, StructuredOutputParser as LangchainStructuredOutputParser } from '@langchain/core/output_parsers'
import { PromptTemplate } from '@langchain/core/prompts'
import { LLMChain } from 'langchain/chains'
import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams } from '../../../src/Interface'
import { ConsoleCallbackHandler } from '../../../src/handler'
import { getBaseClasses } from '../../../src/utils'
import axios from 'axios'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import { streamResponse } from '../../moderation/Moderation'
import { z } from 'zod'
import { OutputFixingParser } from 'langchain/output_parsers'

class HfWeatherChain_Chains implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    baseClasses: string[]
    description: string
    inputs: INodeParams[]
    outputs: INodeOutputsValue[]
    outputParser: BaseOutputParser

    constructor() {
        this.label = 'HfWeather LLM Chain'
        this.name = 'hfWeatherLLmChain'
        this.version = 1.0
        this.type = 'HfLLMChain'
        this.icon = 'HfWeather_Chain.svg'
        this.category = 'Chains'
        this.description = 'Chain to run queries against and weather'
        this.baseClasses = [this.type, ...getBaseClasses(LLMChain)]
        this.inputs = [
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'API Key',
                name: 'apiKey',
                type: 'string',
                placeholder: '请输入和风天气的apiKey'
            }
        ]
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const model = nodeData.inputs?.model as BaseLanguageModel
        const apiKey = nodeData.inputs?.apiKey as string

        // Let's define our parser
        const loggerHandler = new ConsoleCallbackHandler(options.logger)

        const template = `
            你需要从用户提问的内容里提取出用户要查询天气的地点
            用户提问:{input}
            你需要返回以下格式的JSON，//注释部分不要返回
            {{
                "location": "" //提取到的地点
            }}
            `
        const prompt = new PromptTemplate({
            template,
            inputVariables: ['input']
        })

        // 处理JSON异常问题
        const zodSchema = z.object({
            location: z.string().describe('位置地点')
        })
        const structuredOutputParser = LangchainStructuredOutputParser.fromZodSchema(zodSchema as any)
        // NOTE: When we change Flowise to return a json response, the following has to be changed to: JsonStructuredOutputParser
        Object.defineProperty(structuredOutputParser, 'autoFix', {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        })

        const chain = new LLMChain({
            llm: model,
            prompt,
            outputParser: OutputFixingParser.fromLLM(model, structuredOutputParser),
            verbose: process.env.DEBUG === 'true'
        })
        loggerHandler.logger.info(`打印input ${input}`)
        const res = await chain.run(input)
        loggerHandler.logger.info(`打印结果 ${JSON.stringify(res)}`)

        const json = JSON.parse(res)
        let weatherRes = ''
        if (json.location) {
            loggerHandler.logger.info(`检测到location ${json.location}`)
            weatherRes = await getWeatherApi(apiKey, json.location)
        }
        loggerHandler.logger.info(`weatherRes ${weatherRes}`)

        const resPrompt = new PromptTemplate({
            template: `
            根据用户的提问和我给你的数据JSON格式结和并回答用户的问题回答要求详细且有理有据，需要把已有的数据格式化并输出
            用户的问题：${input}
            已有的数据：{res}  
        `,
            inputVariables: ['res']
        })
        const resTxt = await new LLMChain({
            llm: model,
            prompt: resPrompt,
            verbose: process.env.DEBUG === 'true'
        }).run(weatherRes)
        const isStreamable = options.socketIO && options.socketIOClientId

        if (isStreamable) streamResponse(options.socketIO && options.socketIOClientId, resTxt, options.socketIO, options.socketIOClientId)
        return formatResponse(resTxt)
    }
}

const getWeatherApi = async (apiKey: string, location: string) => {
    const cityName = location
    const urlCityList = `https://geoapi.qweather.com/v2/city/lookup?location=${cityName}&key=${apiKey}`
    try {
        const responseCityList = (await axios.get(urlCityList)).data
        if (responseCityList.location) {
            const cityId = responseCityList.location[0].id
            const urlCityWeather = `https://devapi.qweather.com/v7/weather/now?location=${cityId}&key=${apiKey}`
            const responseWeather = await axios.get(urlCityWeather)
            const jsonWeather = await responseWeather.data
            return JSON.stringify(jsonWeather)
        }
        return '{"err_msg": "未查询到您输入的城市"}'
    } catch (error) {
        console.error('报错了', error.response)
        return '{"err_msg": "查询天气出错"}'
    }
}

module.exports = { nodeClass: HfWeatherChain_Chains }
