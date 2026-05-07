/**
 * One-off generator: node scripts/generate-dsa-hierarchy.mjs
 * Writes dsa-hierarchy.sample.json next to this file (paste into admin as dataset dsa).
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "dsa-hierarchy.sample.json");

const L = (path) => `https://leetcode.com/problems/${path}/`;

const hierarchy = [
  {
    id: "array",
    name: "Array",
    tree: [
      {
        name: "Sliding Window",
        children: [
          {
            name: "Fixed Size",
            problems: [
              { name: "Maximum Average Subarray I", url: L("maximum-average-subarray-i") },
              { name: "Grumpy Bookstore Owner", url: L("grumpy-bookstore-owner") },
            ],
          },
          {
            name: "Variable Size",
            children: [
              {
                name: "Expand–Shrink",
                problems: [
                  { name: "Minimum Window Substring", url: L("minimum-window-substring") },
                  { name: "Longest Substring Without Repeating Characters", url: L("longest-substring-without-repeating-characters") },
                ],
              },
              {
                name: "Monotonic Window",
                problems: [{ name: "Sliding Window Maximum", url: L("sliding-window-maximum") }],
              },
            ],
          },
        ],
      },
      {
        name: "Two Pointer",
        children: [
          {
            name: "Opposite ends (left + right)",
            problems: [
              { name: "Two Sum", url: L("two-sum") },
              { name: "3Sum", url: L("3sum") },
              { name: "Container With Most Water", url: L("container-with-most-water") },
            ],
          },
          {
            name: "Same direction (fast & slow)",
            problems: [
              { name: "Remove Duplicates from Sorted Array", url: L("remove-duplicates-from-sorted-array") },
              { name: "Move Zeroes", url: L("move-zeroes") },
            ],
          },
          {
            name: "Partition / Dutch flag",
            problems: [{ name: "Sort Colors", url: L("sort-colors") }],
          },
        ],
      },
      {
        name: "Prefix Based",
        children: [
          {
            name: "Prefix Sum",
            problems: [
              { name: "Subarray Sum Equals K", url: L("subarray-sum-equals-k") },
              { name: "Range Sum Query - Immutable", url: L("range-sum-query-immutable") },
            ],
          },
          {
            name: "Prefix XOR",
            problems: [{ name: "Maximum XOR of Two Numbers in an Array", url: L("maximum-xor-of-two-numbers-in-an-array") }],
          },
          {
            name: "2D Prefix",
            problems: [{ name: "Range Sum Query 2D - Immutable", url: L("range-sum-query-2d-immutable") }],
          },
        ],
      },
      {
        name: "Kadane's / Subarray",
        children: [
          {
            name: "Max subarray sum (Kadane's)",
            problems: [{ name: "Maximum Subarray", url: L("maximum-subarray") }],
          },
          {
            name: "Max product subarray",
            problems: [{ name: "Maximum Product Subarray", url: L("maximum-product-subarray") }],
          },
          {
            name: "Subarray with given XOR / sum",
            problems: [
              { name: "Subarray Sum Equals K", url: L("subarray-sum-equals-k") },
              { name: "Contiguous Array", url: L("contiguous-array") },
            ],
          },
        ],
      },
      {
        name: "Binary Search",
        children: [
          {
            name: "on index",
            problems: [
              { name: "Binary Search", url: L("binary-search") },
              { name: "Search in Rotated Sorted Array", url: L("search-in-rotated-sorted-array") },
            ],
          },
          {
            name: "on answer",
            problems: [
              { name: "Koko Eating Bananas", url: L("koko-eating-bananas") },
              { name: "Capacity To Ship Packages Within D Days", url: L("capacity-to-ship-packages-within-d-days") },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "string",
    name: "String",
    tree: [
      {
        name: "Sliding Window",
        children: [
          {
            name: "Longest substring without repeat",
            problems: [{ name: "Longest Substring Without Repeating Characters", url: L("longest-substring-without-repeating-characters") }],
          },
          {
            name: "Minimum window substring",
            problems: [{ name: "Minimum Window Substring", url: L("minimum-window-substring") }],
          },
          {
            name: "Anagram / permutation in string",
            problems: [
              { name: "Find All Anagrams in a String", url: L("find-all-anagrams-in-a-string") },
              { name: "Permutation in String", url: L("permutation-in-string") },
            ],
          },
        ],
      },
      {
        name: "Two Pointers",
        children: [
          {
            name: "Palindrome check",
            problems: [{ name: "Valid Palindrome", url: L("valid-palindrome") }],
          },
          {
            name: "Reverse words / characters",
            problems: [{ name: "Reverse Words in a String", url: L("reverse-words-in-a-string") }],
          },
          {
            name: "String compression",
            problems: [{ name: "String Compression", url: L("string-compression") }],
          },
        ],
      },
      {
        name: "Pattern Matching",
        children: [
          { name: "KMP (failure function)", problems: [{ name: "Implement strStr()", url: L("implement-strstr") }] },
          { name: "Rabin-Karp (rolling hash)", problems: [] },
          { name: "Z-algorithm", problems: [] },
        ],
      },
    ],
  },
  {
    id: "hash-map",
    name: "Hash map",
    tree: [
      { name: "Frequency Based", problems: [{ name: "Top K Frequent Elements", url: L("top-k-frequent-elements") }] },
      { name: "Lookup Based", problems: [{ name: "Two Sum", url: L("two-sum") }] },
      { name: "Set Based", problems: [{ name: "Longest Consecutive Sequence", url: L("longest-consecutive-sequence") }] },
      { name: "Index Mapping", problems: [] },
      { name: "Grouping Pattern", problems: [{ name: "Group Anagrams", url: L("group-anagrams") }] },
    ],
  },
  {
    id: "stack",
    name: "Stack",
    tree: [
      {
        name: "Monotonic Stack",
        children: [
          {
            name: "Increasing",
            problems: [{ name: "Daily Temperatures", url: L("daily-temperatures") }],
          },
          {
            name: "Decreasing",
            problems: [{ name: "Largest Rectangle in Histogram", url: L("largest-rectangle-in-histogram") }],
          },
        ],
      },
      {
        name: "Nearest Element",
        children: [
          { name: "Next Greater", problems: [{ name: "Next Greater Element I", url: L("next-greater-element-i") }] },
          { name: "Next Smaller", problems: [] },
          { name: "Previous Variants", problems: [] },
        ],
      },
      { name: "Range / Span", problems: [] },
      { name: "min/Max Stack", problems: [{ name: "Min Stack", url: L("min-stack") }] },
      {
        name: "Expression Handling",
        problems: [
          { name: "Valid Parentheses", url: L("valid-parentheses") },
          { name: "Basic Calculator", url: L("basic-calculator") },
        ],
      },
      { name: "Histogram Pattern", problems: [{ name: "Largest Rectangle in Histogram", url: L("largest-rectangle-in-histogram") }] },
    ],
  },
  {
    id: "queue-deque",
    name: "Queue / Deque",
    tree: [
      { name: "FIFO Processing", problems: [{ name: "Design Circular Queue", url: L("design-circular-queue") }] },
      { name: "Level-wise Processing", problems: [{ name: "Binary Tree Level Order Traversal", url: L("binary-tree-level-order-traversal") }] },
      { name: "Circular Queue Pattern", problems: [] },
      { name: "Deque Based", problems: [{ name: "Sliding Window Maximum", url: L("sliding-window-maximum") }] },
    ],
  },
  {
    id: "linked-list",
    name: "Linked List",
    tree: [
      {
        name: "Pointer Techniques",
        children: [
          {
            name: "Fast–Slow",
            problems: [
              { name: "Middle of the Linked List", url: L("middle-of-the-linked-list") },
              { name: "Linked List Cycle", url: L("linked-list-cycle") },
            ],
          },
          {
            name: "Cycle Detection",
            problems: [{ name: "Linked List Cycle II", url: L("linked-list-cycle-ii") }],
          },
        ],
      },
      {
        name: "Reversal",
        children: [
          { name: "Full Reverse", problems: [{ name: "Reverse Linked List", url: L("reverse-linked-list") }] },
          { name: "Partial (k-group)", problems: [{ name: "Reverse Nodes in k-Group", url: L("reverse-nodes-in-k-group") }] },
        ],
      },
      { name: "Merge Lists", problems: [{ name: "Merge Two Sorted Lists", url: L("merge-two-sorted-lists") }] },
    ],
  },
  {
    id: "trees",
    name: "Trees",
    tree: [
      {
        name: "Traversal",
        children: [
          {
            name: "DFS (Pre / In / Post order)",
            problems: [
              { name: "Binary Tree Preorder Traversal", url: L("binary-tree-preorder-traversal") },
              { name: "Binary Tree Inorder Traversal", url: L("binary-tree-inorder-traversal") },
            ],
          },
          {
            name: "BFS (Level Order / zigzag / right side view)",
            problems: [
              { name: "Binary Tree Level Order Traversal", url: L("binary-tree-level-order-traversal") },
              { name: "Binary Tree Zigzag Level Order Traversal", url: L("binary-tree-zigzag-level-order-traversal") },
              { name: "Binary Tree Right Side View", url: L("binary-tree-right-side-view") },
            ],
          },
        ],
      },
      {
        name: "Recursion Patterns",
        children: [
          { name: "Top Down approach", problems: [{ name: "Maximum Depth of Binary Tree", url: L("maximum-depth-of-binary-tree") }] },
          { name: "Bottom Up approach", problems: [{ name: "Diameter of Binary Tree", url: L("diameter-of-binary-tree") }] },
        ],
      },
      {
        name: "Path Based",
        children: [
          { name: "Max path sum", problems: [{ name: "Binary Tree Maximum Path Sum", url: L("binary-tree-maximum-path-sum") }] },
          { name: "Diameter / Height / depth", problems: [{ name: "Diameter of Binary Tree", url: L("diameter-of-binary-tree") }] },
        ],
      },
      {
        name: "BST (Binary Search Tree)",
        problems: [
          { name: "Validate Binary Search Tree", url: L("validate-binary-search-tree") },
          { name: "Kth Smallest Element in a BST", url: L("kth-smallest-element-in-a-bst") },
        ],
      },
    ],
  },
  {
    id: "recursion",
    name: "Recursion",
    tree: [
      {
        name: "Backtracking",
        children: [
          {
            name: "Exploration",
            children: [
              {
                name: "Decision Tree",
                problems: [{ name: "Subsets", url: L("subsets") }],
              },
              {
                name: "Choose–Explore–Unchoose",
                problems: [{ name: "Permutations", url: L("permutations") }],
              },
              {
                name: "Subsets (power set)",
                problems: [{ name: "Subsets", url: L("subsets") }],
              },
              {
                name: "Permutations / Combinations (nCr)",
                problems: [{ name: "Combinations", url: L("combinations") }],
              },
              {
                name: "Word search on grid",
                problems: [{ name: "Word Search", url: L("word-search") }],
              },
              {
                name: "Palindrome partitioning",
                problems: [{ name: "Palindrome Partitioning", url: L("palindrome-partitioning") }],
              },
            ],
          },
          { name: "Pruning / State Tracking", problems: [{ name: "N-Queens", url: L("n-queens") }] },
        ],
      },
      {
        name: "Divide & Conquer",
        children: [
          { name: "Merge sort pattern", problems: [{ name: "Sort List", url: L("sort-list") }] },
          { name: "Quick select (Kth largest)", problems: [{ name: "Kth Largest Element in an Array", url: L("kth-largest-element-in-an-array") }] },
          { name: "Count inversions", problems: [] },
        ],
      },
    ],
  },
  {
    id: "heap",
    name: "Heap",
    tree: [
      {
        name: "Top K / Kth Element / k closest points",
        problems: [
          { name: "Kth Largest Element in an Array", url: L("kth-largest-element-in-an-array") },
          { name: "K Closest Points to Origin", url: L("k-closest-points-to-origin") },
        ],
      },
      {
        name: "Greedy + Heap",
        children: [
          { name: "Task scheduler", problems: [{ name: "Task Scheduler", url: L("task-scheduler") }] },
          { name: "Meeting rooms", problems: [{ name: "Meeting Rooms II", url: L("meeting-rooms-ii") }] },
          { name: "Reorganize string", problems: [{ name: "Reorganize String", url: L("reorganize-string") }] },
          { name: "Huffman encoding", problems: [] },
        ],
      },
      { name: "K-way Merge", problems: [{ name: "Merge k Sorted Lists", url: L("merge-k-sorted-lists") }] },
    ],
  },
  {
    id: "graphs",
    name: "Graphs",
    tree: [
      {
        name: "Traversal",
        children: [
          { name: "BFS", problems: [{ name: "Number of Islands", url: L("number-of-islands") }] },
          { name: "DFS", problems: [{ name: "Number of Islands", url: L("number-of-islands") }] },
        ],
      },
      {
        name: "Cycle Detection",
        children: [
          { name: "Directed", problems: [{ name: "Course Schedule", url: L("course-schedule") }] },
          { name: "Undirected", problems: [] },
        ],
      },
      {
        name: "Topological Sort",
        children: [
          { name: "Kahn's algorithm (BFS in-degree)", problems: [{ name: "Course Schedule II", url: L("course-schedule-ii") }] },
          { name: "DFS-based topo sort", problems: [] },
        ],
      },
      {
        name: "Shortest Path",
        children: [
          { name: "Dijkstra", problems: [] },
          { name: "Bellman-Ford", problems: [] },
          { name: "Floyd-Warshall (all pairs)", problems: [] },
        ],
      },
      {
        name: "Spanning Tree",
        children: [
          { name: "Kruskal", problems: [] },
          { name: "Prim's", problems: [] },
        ],
      },
      {
        name: "Union-Find (DSU)",
        problems: [{ name: "Number of Provinces", url: L("number-of-provinces") }],
      },
      {
        name: "Bipartite / Multi-source BFS / 0-1 BFS",
        problems: [{ name: "Is Graph Bipartite?", url: L("is-graph-bipartite") }],
      },
    ],
  },
  {
    id: "trie",
    name: "Trie",
    tree: [
      {
        name: "Prefix Based",
        children: [
          {
            name: "Insert / Search",
            problems: [{ name: "Implement Trie (Prefix Tree)", url: L("implement-trie-prefix-tree") }],
          },
          { name: "Prefix Match", problems: [{ name: "Replace Words", url: L("replace-words") }] },
        ],
      },
      { name: "Bitwise Trie", problems: [] },
    ],
  },
  {
    id: "dynamic-programming",
    name: "Dynamic Programming",
    tree: [
      {
        name: "Core",
        children: [
          { name: "1D", problems: [{ name: "Climbing Stairs", url: L("climbing-stairs") }, { name: "House Robber", url: L("house-robber") }] },
          { name: "2D", problems: [{ name: "Unique Paths", url: L("unique-paths") }, { name: "Longest Common Subsequence", url: L("longest-common-subsequence") }] },
        ],
      },
      {
        name: "Transition Type",
        children: [
          { name: "Linear DP", problems: [{ name: "Fibonacci Number", url: L("fibonacci-number") }] },
          { name: "Grid DP", problems: [{ name: "Minimum Path Sum", url: L("minimum-path-sum") }] },
          { name: "Decision DP", problems: [{ name: "Coin Change", url: L("coin-change") }] },
        ],
      },
      {
        name: "Pattern Types",
        children: [
          { name: "Knapsack", problems: [{ name: "Partition Equal Subset Sum", url: L("partition-equal-subset-sum") }] },
          { name: "Sequence DP", problems: [{ name: "Longest Increasing Subsequence", url: L("longest-increasing-subsequence") }] },
          { name: "Partition DP", problems: [{ name: "Palindrome Partitioning II", url: L("palindrome-partitioning-ii") }] },
          { name: "Interval DP", problems: [{ name: "Burst Balloons", url: L("burst-balloons") }] },
        ],
      },
      {
        name: "Advanced",
        children: [
          { name: "Bitmask DP", problems: [] },
          { name: "Digit DP", problems: [] },
          { name: "DP on Trees", problems: [{ name: "House Robber III", url: L("house-robber-iii") }] },
        ],
      },
      {
        name: "Optimization",
        children: [
          { name: "Memoization", problems: [{ name: "Climbing Stairs", url: L("climbing-stairs") }] },
          { name: "Tabulation", problems: [{ name: "Coin Change", url: L("coin-change") }] },
        ],
      },
    ],
  },
  {
    id: "greedy",
    name: "Greedy",
    tree: [
      {
        name: "Interval Greedy",
        children: [
          { name: "Activity Selection", problems: [] },
          { name: "Non-overlapping Intervals", problems: [{ name: "Non-overlapping Intervals", url: L("non-overlapping-intervals") }] },
          { name: "Minimum Removals", problems: [] },
        ],
      },
      {
        name: "Scheduling Greedy",
        children: [
          { name: "Deadline Based Scheduling", problems: [] },
          { name: "Profit Based Selection", problems: [] },
        ],
      },
      {
        name: "Resource Allocation",
        children: [
          { name: "Minimum Platforms / Rooms", problems: [] },
          { name: "Meeting Rooms", problems: [{ name: "Meeting Rooms", url: L("meeting-rooms") }] },
        ],
      },
      { name: "Jump Game Pattern", problems: [{ name: "Jump Game", url: L("jump-game") }, { name: "Jump Game II", url: L("jump-game-ii") }] },
      { name: "Huffman / Merge Cost", problems: [] },
    ],
  },
  {
    id: "bit-manipulation",
    name: "Bit Manipulation",
    tree: [
      {
        name: "Core",
        children: [
          { name: "XOR Pattern", problems: [{ name: "Single Number", url: L("single-number") }] },
          { name: "Bit Masking", problems: [{ name: "Subsets", url: L("subsets") }] },
        ],
      },
      {
        name: "Usage",
        children: [
          { name: "Subset via Bits", problems: [] },
          { name: "Bit Checks", problems: [{ name: "Number of 1 Bits", url: L("number-of-1-bits") }] },
          { name: "Prefix XOR", problems: [{ name: "Find the Longest Awesome Substring", url: L("find-the-longest-awesome-substring") }] },
        ],
      },
    ],
  },
  {
    id: "sorting",
    name: "Sorting Algorithms",
    tree: [
      { name: "Bubble Sort", problems: [] },
      { name: "Selection Sort", problems: [] },
      { name: "Insertion Sort", problems: [] },
      { name: "Merge Sort", problems: [{ name: "Sort List", url: L("sort-list") }] },
      { name: "Quick Sort", problems: [{ name: "Sort an Array", url: L("sort-an-array") }] },
      { name: "Heap Sort", problems: [] },
      { name: "Counting Sort", problems: [] },
      { name: "Radix Sort", problems: [] },
      { name: "Bucket Sort", problems: [] },
    ],
  },
  {
    id: "range-structures",
    name: "Range Structures",
    tree: [
      {
        name: "Segment Tree",
        children: [
          { name: "Range Query", problems: [] },
          { name: "Lazy Propagation", problems: [] },
        ],
      },
      {
        name: "Fenwick Tree",
        children: [
          { name: "Prefix Query", problems: [] },
        ],
      },
    ],
  },
];

writeFileSync(out, JSON.stringify(hierarchy, null, 2), "utf8");
console.log("Wrote", out, hierarchy.length, "root topics");
