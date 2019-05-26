console.time('looper')

let arr = [];

for (let i = 0; i < 1000; i++) {
    arr.push(i)
}

console.timeEnd('looper')