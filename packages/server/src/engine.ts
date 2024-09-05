import { fileFromPath } from 'openai'
import { App } from '.'
import { IReactFlowObject } from './Interface'
import path from 'path'
import { constructGraphs, getEndingNodes, isFlowValidForStream } from './utils'
import logger from './utils/logger'

export async function engineRun(serverApp: App) {
    const jsonData = await (await fileFromPath(path.resolve(__dirname, './data.json'))).text()
    const parsedFlowData: IReactFlowObject = JSON.parse(jsonData)
    const nodes = parsedFlowData.nodes
    const edges = parsedFlowData.edges

    /*** Get Ending Node with Directed Graph  ***/
    const { graph, nodeDependencies } = constructGraphs(nodes, edges)
    const directedGraph = graph
    const endingNodes = getEndingNodes(nodeDependencies, directedGraph, nodes)
    logger.info('🚀打印graph endingNodes')

    let isStreamValid = false

    if (endingNodes.filter((node) => node.data.category === 'Multi Agents' || node.data.category === 'Sequential Agents').length) {
        logger.info('🚀 ~ file: engine.ts ~ line 22 ~ engineRun ~ endingNodes', endingNodes)
    }

    for (const endingNode of endingNodes) {
        const endingNodeData = endingNode.data

        const isEndingNode = endingNodeData?.outputs?.output === 'EndingNode'

        // Once custom function ending node exists, no need to do follow-up checks.
        if (isEndingNode) continue

        if (
            endingNodeData.outputs &&
            Object.keys(endingNodeData.outputs).length &&
            !Object.values(endingNodeData.outputs ?? {}).includes(endingNodeData.name)
        ) {
            throw new Error(
                `Output of ${endingNodeData.label} (${endingNodeData.id}) must be ${endingNodeData.label}, can't be an Output Prediction`
            )
        }

        isStreamValid = isFlowValidForStream(nodes, endingNodeData)
    }
    logger.info(`🚀打印isStreamValid ${isStreamValid}`)
}
