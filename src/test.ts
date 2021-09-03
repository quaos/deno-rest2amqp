interface X {
    s: string;
    len: number;
}

let x: X | undefined = undefined;
await new Promise(resolve => {
    x = { s: "yo", len: 0};
    x.len = x.s.length;
    resolve(x)
});
console.log(x!.s, "=>", x!.len);
