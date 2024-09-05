import { Tool } from '@langchain/core/tools'
import axios from 'axios'

export class HfWeather extends Tool {
    name = 'hfWeather'
    description = `Useful for getting the result of a city weather.`

    async _call(input: string) {
        const cityName = input
        const apiKey = 'ebd590e62ca24814a3cfb7ec424eefb8'
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
            return '未查询到您输入的城市'
        } catch (error) {
            console.error('报错了', error.response)
            return '查询天气出错'
        }
    }
}
