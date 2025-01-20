export interface TreeNodeJSON<T> {
    version: string;
    level: number;
    data: T;
    children: TreeNodeJSON<T>[];
}

export interface TreeStateJSON<T> {
    root: TreeNodeJSON<T>;
    maxLevel: number;
    currentNode: string | null; // stores version of current node
}

interface ITreeNode<T> {
    version: string;
    children: TreeNode<T>[];
    level: number;
    data: T;
    addChild(child: TreeNode<T>): void;
    toJSON(): TreeNodeJSON<T>;
}

class TreeNode<T> implements ITreeNode<T> {
    version: string;
    children: TreeNode<T>[];
    level: number;
    data: T;

    constructor(level: number, version: number, data: T) {
        this.version = `${level}@${version}`;
        this.children = [];
        this.level = level;
        this.data = data;
    }

    addChild(child: TreeNode<T>): void {
        this.children.push(child);
    }

    toJSON(): TreeNodeJSON<T> {
        return {
            version: this.version,
            level: this.level,
            data: this.data,
            children: this.children.map(child => child.toJSON())
        };
    }

    static fromJSON<T>(data: TreeNodeJSON<T>): TreeNode<T> {
        const [level, version] = data.version.split('@').map(Number);
        const node = new TreeNode(level, version, data.data);
        node.children = data.children.map(childData => TreeNode.fromJSON(childData));
        return node;
    }
}

interface IVersionedTree<T> {
    root: TreeNode<T>;
    levelMap: Map<number, TreeNode<T>[]>;
    maxLevel: number;
    currentNode: TreeNode<T>;
    branchRandomly(batchedData: (numChildren: number, childVersions: string[]) => {data: T, version: string}[]): string
    print(): void;
    save(): string;
    load(jsonTree: TreeStateJSON<T>): void;
    loadString(jsonString: string): void;

}

export class VersionedTree<T> implements IVersionedTree<T> {
    root: TreeNode<T>;
    levelMap: Map<number, TreeNode<T>[]>;
    maxLevel: number;
    currentNode: TreeNode<T>;

    constructor({ initialData, treeState }: { initialData?: T, treeState?: TreeStateJSON<T> }) {

        if (treeState) {
            this.levelMap = new Map<number, TreeNode<T>[]>();
            this.maxLevel = 0;
            this.currentNode = null;
            this.root = null;
            this.load(treeState);
            return;
        }

        this.root = new TreeNode(0, 1, initialData);
        this.levelMap = new Map<number, TreeNode<T>[]>();
        this.levelMap.set(0, [this.root]);
        this.maxLevel = 0;
        this.currentNode = this.root;
    }

  
    private rebuildLevelMap(node: TreeNode<T>): void {
        const level = node.level;
        if (!this.levelMap.has(level)) {
            this.levelMap.set(level, []);
        }
        this.levelMap.get(level)?.push(node);
        
        node.children.forEach(child => {
            this.rebuildLevelMap(child);
        });
    }

    private findNodeByVersion(version: string): TreeNode<T> | null {
        const searchNode = (node: TreeNode<T>): TreeNode<T> | null => {
            if (node.version === version) {
                return node;
            }
            for (const child of node.children) {
                const found = searchNode(child);
                if (found) return found;
            }
            return null;
        };
        return searchNode(this.root);
    }

    getCurrentNode(): TreeNode<T> {
        return this.currentNode;
    }

    branchRandomly(batchedData: (numChildren: number, childVersions: string[]) => {data: T, version: string}[]): string {
        const currentLevelNodes = this.levelMap.get(this.maxLevel);
        
        if (!currentLevelNodes || currentLevelNodes.length === 0) {
            throw new Error("No nodes found at current level");
        }

        const randomParentIndex = Math.floor(Math.random() * currentLevelNodes.length);
        const randomParent = currentLevelNodes[randomParentIndex];
        
        const newLevel = this.maxLevel + 1;
        if (!this.levelMap.has(newLevel)) {
            this.levelMap.set(newLevel, []);
        }

        const newLevelNodes = this.levelMap.get(newLevel);
        if (!newLevelNodes) {
            throw new Error("Failed to create new level in map");
        }

        const numChildren = Math.floor(Math.random() * 4) + 1;

        const versions = Array.from({ length: numChildren }, (_, i) => {
            return `${newLevel}@${i + 1}`;
        });


        const childrenData = batchedData(numChildren, versions);

        // Create children with mapped data
        for (let i = 0; i < childrenData.length; i++) {
            // console.log(childrenData[i]);
            let {data, version} = childrenData[i];
            const newNode = new TreeNode(newLevel, +version.split('@')[1], data);
            randomParent.addChild(newNode);
            newLevelNodes.push(newNode);
        }

        // Select random child as current node
        const randomChildIndex = Math.max(0, Math.min(numChildren - 1, Math.floor(Math.random() * numChildren)));
        // console.log('randomChildIndex', numChildren, randomChildIndex, randomParent.children.length);
        this.currentNode = randomParent.children[randomChildIndex % randomParent.children.length];

        this.maxLevel = newLevel;
        return this.currentNode.version;
    }

    print(): void {
        const getLines = (node: TreeNode<T>, isLast: boolean = true, prefix: string = ""): string[] => {
            const lines: string[] = [];
            
            let nodeLine = prefix;
            if (prefix) {
                nodeLine += isLast ? "└── " : "├── ";
            }
            nodeLine += node.version;
            nodeLine += ` (${JSON.stringify(node.data)})`;
            if (node === this.currentNode) {
                nodeLine += " *"; // Mark current node
            }
            lines.push(nodeLine);
            
            const childPrefix = prefix + (isLast ? "    " : "│   ");
            node.children.forEach((child, index) => {
                const isLastChild = index === node.children.length - 1;
                lines.push(...getLines(child, isLastChild, childPrefix));
            });
            
            return lines;
        };

        const treeString = getLines(this.root).join("\n");
        console.log(treeString);
    }

    printMinimal(): void {
        const getLines = (node: TreeNode<T>, isLast: boolean = true, prefix: string = ""): string[] => {
            const lines: string[] = [];
            
            let nodeLine = prefix;
            if (prefix) {
                nodeLine += isLast ? "└── " : "├── ";
            }
            nodeLine += node.version;
            if (node === this.currentNode) {
                nodeLine += " *"; // Mark current node
            }
            lines.push(nodeLine);
            
            const childPrefix = prefix + (isLast ? "    " : "│   ");
            node.children.forEach((child, index) => {
                const isLastChild = index === node.children.length - 1;
                lines.push(...getLines(child, isLastChild, childPrefix));
            });
            
            return lines;
        };

        const treeString = getLines(this.root).join("\n");
        console.log(treeString);
    }

    save(): string {
        const treeState: TreeStateJSON<T> = {
            root: this.root.toJSON(),
            maxLevel: this.maxLevel,
            currentNode: this.currentNode.version
        };
        return JSON.stringify(treeState, null, 2);
    }

    load(treeState: TreeStateJSON<T>): void {

        this.maxLevel = treeState.maxLevel;
        this.root = TreeNode.fromJSON(treeState.root);
        
        // Rebuild the level map
        this.levelMap.clear();
        this.rebuildLevelMap(this.root);

        // console.log('root', this.root, treeState.currentNode);

        // Restore current node
        const currentNode = this.findNodeByVersion(treeState.currentNode!);
        if (!currentNode) {
            throw new Error("Failed to restore current node");
        }
        this.currentNode = currentNode;
    }

    loadString(jsonString: string): void {
        const treeState: TreeStateJSON<T> = JSON.parse(jsonString);
        this.maxLevel = treeState.maxLevel;
        this.root = TreeNode.fromJSON(treeState.root);
        
        // Rebuild the level map
        this.levelMap.clear();
        this.rebuildLevelMap(this.root);

        // Restore current node
        const currentNode = this.findNodeByVersion(treeState.currentNode!);
        if (!currentNode) {
            throw new Error("Failed to restore current node");
        }
        this.currentNode = currentNode;
    }

    /**
     * Updates the data of the current node
     * @param newData Updated data to set
     */
    updateCurrentData(newData: T): void {
        const currentNode = this.getCurrentNode();
        if (!currentNode) {
            throw new Error('No current node available');
        }
        currentNode.data = newData;
    }
}

// Example usage:
// interface ExampleData {
//     name: string;
//     value: string;
// }

// const tree = new VersionedTree<ExampleData>({ name: "root", value: "0" });
// console.log("Initial tree:");
// tree.print();

// // Make some random branches with data mapping
// console.log("\nBranching randomly 3 times:");
// for (let i = 0; i < 3; i++) {

//     const randomChildVersion = tree.branchRandomly((numChildren, childVersions) => {
        
//         // TODO: call llm here to generate numChildren data worth of branches.
        
//         return childVersions.map((version, index) => ({
//             data: { name: `${version}`, value: `${index * 10}` },
//             version
//         }));
//     });

//     console.log(`\n Randomly selected child ${randomChildVersion}:`);
//     tree.print();
// }

// // Save the tree state
// const savedState = tree.save();
// console.log("\nSaved tree state:", savedState);

// // Create a new tree and load the saved state
// const newTree = new VersionedTree<ExampleData>({ name: "root", value: "0" });
// newTree.load(savedState);
// console.log("\nReconstructed tree:");
// newTree.print();
