import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

function randomSha() {
  const chars = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function makeRepo(name, authors, modules, messages, commitCount = 280) {
  const commits = []
  const activeFiles = new Set()
  const authorTally = new Map()

  let timestamp = new Date('2023-01-01T08:00:00Z').getTime()

  for (let i = 1; i <= commitCount; i++) {
    timestamp += Math.floor(1000 * 60 * (30 + Math.random() * 300))
    const date = new Date(timestamp).toISOString()

    const author = authors[i % authors.length]
    authorTally.set(author.name, (authorTally.get(author.name) || 0) + 1)

    const modKeys = Object.keys(modules)
    const mod = modKeys[Math.floor(Math.random() * modKeys.length)]
    const fileList = modules[mod]
    const file = fileList[Math.floor(Math.random() * fileList.length)]
    const filePath = `${mod}/${file}`

    const fileChanges = []
    if (!activeFiles.has(filePath)) {
      activeFiles.add(filePath)
      fileChanges.push({ path: filePath, status: 'A' })
    } else {
      fileChanges.push({ path: filePath, status: 'M' })
      if (Math.random() < 0.2) {
        const sec = fileList[Math.floor(Math.random() * fileList.length)]
        if (sec !== file) fileChanges.push({ path: `${mod}/${sec}`, status: 'M' })
      }
    }

    const msg = `${messages[i % messages.length]} (#${200 + i})`
    commits.push({
      sha: randomSha(),
      author: author.name,
      date,
      message: msg,
      files: fileChanges,
    })
  }

  const contributors = authors.map((a) => ({
    name: a.name,
    commits: authorTally.get(a.name) || 1,
    color: a.color,
  })).sort((a, b) => b.commits - a.commits)

  return {
    repo: name,
    totalCommits: commits.length,
    commits,
    contributors,
  }
}

mkdirSync(resolve('public/data'), { recursive: true })

// 1. Linux
const linuxData = makeRepo(
  'torvalds/linux',
  [
    { name: 'Linus Torvalds', color: '#00f0ff' },
    { name: 'Greg Kroah-Hartman', color: '#ff0055' },
    { name: 'Al Viro', color: '#ffe600' },
    { name: 'Dave Chinner', color: '#00ff66' },
    { name: 'Thomas Gleixner', color: '#a855f7' },
    { name: 'Arnd Bergmann', color: '#ff7700' },
  ],
  {
    arch: ['x86/kernel/setup.c', 'arm64/mm/fault.c', 'riscv/kernel/cpu.c', 'x86/include/asm/cpu.h'],
    drivers: ['net/ethernet/intel/e1000e.c', 'gpu/drm/i915/gt.c', 'usb/core/hub.c', 'block/nvme/core.c'],
    kernel: ['sched/core.c', 'fork.c', 'bpf/core.c', 'time/timer.c', 'locking/mutex.c'],
    fs: ['ext4/super.c', 'btrfs/inode.c', 'vfs/inode.c', 'proc/base.c'],
    net: ['ipv4/tcp.c', 'core/dev.c', 'socket.c', 'ipv6/ip6_output.c'],
    mm: ['page_alloc.c', 'memory.c', 'vmscan.c', 'slub.c'],
  },
  [
    'sched: optimize CFS bandwidth timer throttling',
    'ext4: fix journal credit overflow in data journaling mode',
    'bpf: add verifier support for 64-bit bounded iterators',
    'net/tcp: avoid unnecessary window shrinkage on RST',
    'x86/cpu: mitigate speculative branch side channels',
    'mm: streamline per-cpu page allocator lockless fastpath',
    'nvme: handle transient PCIe error during controller reset',
  ],
  320
)
writeFileSync('public/data/linux.json', JSON.stringify(linuxData, null, 2))

// 2. React
const reactData = makeRepo(
  'facebook/react',
  [
    { name: 'Dan Abramov', color: '#00f0ff' },
    { name: 'Sophie Alpert', color: '#ff0055' },
    { name: 'Sebastian Markbåge', color: '#ffe600' },
    { name: 'Andrew Clark', color: '#00ff66' },
    { name: 'Luna Ruan', color: '#a855f7' },
    { name: 'Dominic Gannaway', color: '#ff7700' },
  ],
  {
    'packages/react': ['src/React.js', 'src/ReactHooks.js', 'src/ReactElement.js', 'index.js'],
    'packages/react-dom': ['src/client/ReactDOMRoot.js', 'src/client/ReactDOMComponent.js', 'src/events/DOMPluginEventSystem.js'],
    'packages/react-reconciler': ['src/ReactFiberWorkLoop.js', 'src/ReactFiberBeginWork.js', 'src/ReactFiberCommitWork.js'],
    'packages/scheduler': ['src/Scheduler.js', 'src/SchedulerPriorities.js'],
    scripts: ['jest/config.js', 'rollup/build.js', 'release/prepare.js'],
  },
  [
    'feat(fiber): enable continuous priority lane scheduling',
    'fix(dom): preserve input selection range on synthetic re-render',
    'perf(reconciler): memoize alternate fibers during transition bailouts',
    'feat(hooks): introduce useActionState for form mutations',
    'refactor(scheduler): vectorize min-heap task priority queue',
  ],
  290
)
writeFileSync('public/data/react.json', JSON.stringify(reactData, null, 2))

// 3. Redis
const redisData = makeRepo(
  'redis/redis',
  [
    { name: 'Salvatore Sanfilippo', color: '#ff0055' },
    { name: 'Pieter Noordhuis', color: '#00f0ff' },
    { name: 'Oran Agra', color: '#ffe600' },
    { name: 'Yossi Gottlieb', color: '#00ff66' },
    { name: 'Haikel Guemar', color: '#a855f7' },
  ],
  {
    src: ['server.c', 'networking.c', 't_string.c', 't_hash.c', 'rax.c', 'aof.c', 'rdb.c', 'cluster.c'],
    deps: ['hiredis/hiredis.c', 'jemalloc/src/arena.c', 'lua/src/lapi.c'],
    tests: ['unit/protocol.tcl', 'unit/cluster.tcl', 'unit/expire.tcl'],
    utils: ['generate-command-code.py', 'install_server.sh'],
  },
  [
    'feat(cluster): multi-slot atomic transactional execution',
    'perf(networking): async write buffer flushing to epoll event loop',
    'fix(aof): fsync race condition under heavy rewrite load',
    'feat(modules): expose dictionary radix tree iterator API',
    'perf(memory): optimize jemalloc slab retention parameters',
  ],
  260
)
writeFileSync('public/data/redis.json', JSON.stringify(redisData, null, 2))

// 4. Vue
const vueData = makeRepo(
  'vuejs/core',
  [
    { name: 'Evan You', color: '#00ff66' },
    { name: 'Anthony Fu', color: '#00f0ff' },
    { name: 'Haoqun Jiang', color: '#ff0055' },
    { name: 'Kia King Ishii', color: '#ffe600' },
    { name: 'Linus Borg', color: '#a855f7' },
  ],
  {
    'packages/reactivity': ['src/reactive.ts', 'src/ref.ts', 'src/effect.ts', 'src/computed.ts'],
    'packages/runtime-core': ['src/vnode.ts', 'src/component.ts', 'src/renderer.ts', 'src/apiWatch.ts'],
    'packages/runtime-dom': ['src/index.ts', 'src/modules/class.ts', 'src/modules/style.ts'],
    'packages/compiler-sfc': ['src/parse.ts', 'src/compileScript.ts', 'src/compileTemplate.ts'],
  },
  [
    'feat(reactivity): zero-dependency signal reactivity engine',
    'perf(compiler): hoist static VNode subtrees directly into template',
    'fix(sfc): handle generic typescript macros in defineProps',
    'feat(runtime): introduce async component hydration boundary',
    'perf(renderer): SIMD patch diff algorithm for keyless lists',
  ],
  250
)
writeFileSync('public/data/vue.json', JSON.stringify(vueData, null, 2))

console.log('Generated linux.json, react.json, redis.json, and vue.json presets.')
