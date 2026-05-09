$path = (Get-Item "src\index.css").FullName
$content = [System.IO.File]::ReadAllText($path)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Host "Done: index.css re-written as UTF-8 without BOM"
