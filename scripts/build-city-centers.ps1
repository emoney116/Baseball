param([Parameter(Mandatory=$true)][string]$Source)
$centers = [System.Collections.Generic.SortedDictionary[string,object]]::new()
Import-Csv -LiteralPath $Source -Delimiter '|' | ForEach-Object {
  $city = $_.NAME -replace ' (city|town|village|borough|municipality|CDP|comunidad|zona urbana)$', ''
  $key = ($_.USPS + '|' + $city).ToLowerInvariant()
  if ($centers.ContainsKey($key)) { $centers[$key] = $null }
  else { $centers[$key] = @([double]$_.INTPTLAT, [double]$_.INTPTLONG) }
}
$centers | ConvertTo-Json -Compress -Depth 3 | Set-Content -LiteralPath "$PSScriptRoot/../app/lib/us-city-centers.json" -Encoding utf8
