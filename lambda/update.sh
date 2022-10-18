zip -r updateBestPathGraph.zip . --exclude=*.DS_Store*  --exclude=*.git*
aws s3 cp ./ s3://lambda-neo4j-best-path/ --recursive --exclude "*" --include "updateBestPathGraph.zip"
aws lambda update-function-code --function-name updateBestPathGraph --region ap-northeast-1 --s3-bucket lambda-neo4j-best-path --s3-key updateBestPathGraph.zip