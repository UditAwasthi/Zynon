export const generatePrefixes = (text) => {
    const prefixes = []
    let current = ""

    for (const char of text) {
        current += char
        prefixes.push(current)
    }

    return prefixes
}

//generatePrefixes("udit")
//["u","ud","udi","udit"]