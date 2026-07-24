$root = 'C:\Users\Mechergui Rihab\OneDrive\Desktop\Nouveau dossier\habit-tracker'
$count = 0

$files = Get-ChildItem -Path $root -Recurse -File -Include *.jsx,*.js,*.ts,*.tsx,*.html,*.css,*.json,*.sh,*.conf,*.toml,*.java,*.xml,*.rs,*.md | Where-Object {
    $_.FullName -notmatch 'node_modules' -and
    $_.FullName -notmatch '\.git\\' -and
    $_.FullName -notmatch '\\dist\\' -and
    $_.FullName -notmatch '\\build\\' -and
    $_.FullName -ne "$root\frontend\dev\null"
}

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    # Use -creplace for case-sensitive replacement
    # Order matters: longest/most specific first
    $newContent = $content `
        -creplace 'EVOLVIO', 'EVOLVIO' `
        -creplace 'Evolvio', 'Evolvio' `
        -creplace 'evolvio', 'evolvio' `
        -creplace 'EVOLVIA', 'EVOLVIO' `
        -creplace 'Evolvia', 'Evolvio' `
        -creplace 'evolvia', 'evolvio'
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent)
        Write-Host "Fixed: $($file.FullName)"
        $count++
    }
}

Write-Host "`nTotal files fixed: $count"
