function visitNode(node, counts) {
    if (!node || typeof node !== "object") {
        return;
    }
    counts.nodeCount += 1;
    const children = Array.isArray(node.tree) ? node.tree : [];
    for (const child of children) {
        counts.branchCount += 1;
        visitNode(child, counts);
    }
}

export function graphPayloadStats(payload) {
    const counts = {
        nodeCount: 0,
        branchCount: 0,
    };
    if (!Array.isArray(payload)) {
        return counts;
    }
    for (const root of payload) {
        visitNode(root, counts);
    }
    return counts;
}

export function graphPayloadStatsFromJson(text) {
    if (!text || typeof text !== "string") {
        return { nodeCount: 0, branchCount: 0 };
    }
    try {
        return graphPayloadStats(JSON.parse(text));
    } catch {
        return { nodeCount: 0, branchCount: 0 };
    }
}
