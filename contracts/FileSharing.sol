// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FileSharing {
    
    struct File {
        uint256 fileId;
        string ipfsHash;
        string fileName;
        uint256 fileSize;
        address owner;
        uint256 uploadTimestamp;
        bool isPublic;
        string encryptedKey;
    }
    
    struct SharedAccess {
        address sharedWith;
        uint256 sharedTimestamp;
        string encryptedKey;
        bool canReshare;
    }
    
    uint256 private fileCounter;
    mapping(uint256 => File) public files;
    mapping(uint256 => SharedAccess[]) public sharedAccess;
    mapping(address => uint256[]) public userFiles;
    mapping(address => uint256[]) public sharedWithUser;
    
    event FileUploaded(
        uint256 indexed fileId,
        address indexed owner,
        string ipfsHash,
        string fileName,
        uint256 timestamp
    );
    
    event FileShared(
        uint256 indexed fileId,
        address indexed owner,
        address indexed sharedWith,
        uint256 timestamp
    );
    
    event FileAccessRevoked(
        uint256 indexed fileId,
        address indexed owner,
        address indexed revokedFrom
    );
    
    event FileDeleted(
        uint256 indexed fileId,
        address indexed owner
    );
    
    modifier onlyFileOwner(uint256 _fileId) {
        require(files[_fileId].owner == msg.sender, "Not file owner");
        _;
    }
    
    modifier fileExists(uint256 _fileId) {
        require(files[_fileId].owner != address(0), "File does not exist");
        _;
    }
    
    function uploadFile(
        string memory _ipfsHash,
        string memory _fileName,
        uint256 _fileSize,
        bool _isPublic,
        string memory _encryptedKey
    ) external returns (uint256) {
        fileCounter++;
        
        File memory newFile = File({
            fileId: fileCounter,
            ipfsHash: _ipfsHash,
            fileName: _fileName,
            fileSize: _fileSize,
            owner: msg.sender,
            uploadTimestamp: block.timestamp,
            isPublic: _isPublic,
            encryptedKey: _encryptedKey
        });
        
        files[fileCounter] = newFile;
        userFiles[msg.sender].push(fileCounter);
        
        emit FileUploaded(
            fileCounter,
            msg.sender,
            _ipfsHash,
            _fileName,
            block.timestamp
        );
        
        return fileCounter;
    }
    
    function shareFile(
        uint256 _fileId,
        address _sharedWith,
        string memory _encryptedKey,
        bool _canReshare
    ) external fileExists(_fileId) onlyFileOwner(_fileId) {
        require(_sharedWith != address(0), "Invalid address");
        require(_sharedWith != msg.sender, "Cannot share with yourself");
        
        SharedAccess[] storage accesses = sharedAccess[_fileId];
        for (uint256 i = 0; i < accesses.length; i++) {
            require(
                accesses[i].sharedWith != _sharedWith,
                "Already shared with this user"
            );
        }
        
        SharedAccess memory newAccess = SharedAccess({
            sharedWith: _sharedWith,
            sharedTimestamp: block.timestamp,
            encryptedKey: _encryptedKey,
            canReshare: _canReshare
        });
        
        sharedAccess[_fileId].push(newAccess);
        sharedWithUser[_sharedWith].push(_fileId);
        
        emit FileShared(_fileId, msg.sender, _sharedWith, block.timestamp);
    }
    
    function revokeAccess(
        uint256 _fileId,
        address _revokeFrom
    ) external fileExists(_fileId) onlyFileOwner(_fileId) {
        SharedAccess[] storage accesses = sharedAccess[_fileId];
        
        for (uint256 i = 0; i < accesses.length; i++) {
            if (accesses[i].sharedWith == _revokeFrom) {
                accesses[i] = accesses[accesses.length - 1];
                accesses.pop();
                
                uint256[] storage userShared = sharedWithUser[_revokeFrom];
                for (uint256 j = 0; j < userShared.length; j++) {
                    if (userShared[j] == _fileId) {
                        userShared[j] = userShared[userShared.length - 1];
                        userShared.pop();
                        break;
                    }
                }
                
                emit FileAccessRevoked(_fileId, msg.sender, _revokeFrom);
                return;
            }
        }
        
        revert("User does not have access");
    }
    
    function deleteFile(uint256 _fileId) 
        external 
        fileExists(_fileId) 
        onlyFileOwner(_fileId) 
    {
        delete files[_fileId];
        emit FileDeleted(_fileId, msg.sender);
    }
    
    function getUserFiles(address _user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userFiles[_user];
    }
    
    function getSharedFiles(address _user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return sharedWithUser[_user];
    }
    
    function getFile(uint256 _fileId) 
        external 
        view 
        fileExists(_fileId)
        returns (File memory) 
    {
        return files[_fileId];
    }
    
    function getSharedAccess(uint256 _fileId) 
        external 
        view 
        fileExists(_fileId)
        returns (SharedAccess[] memory) 
    {
        return sharedAccess[_fileId];
    }
    
    function hasAccess(uint256 _fileId, address _user) 
        external 
        view 
        fileExists(_fileId)
        returns (bool, string memory) 
    {
        File memory file = files[_fileId];
        
        if (file.owner == _user) {
            return (true, file.encryptedKey);
        }
        
        if (file.isPublic) {
            return (true, file.encryptedKey);
        }
        
        SharedAccess[] memory accesses = sharedAccess[_fileId];
        for (uint256 i = 0; i < accesses.length; i++) {
            if (accesses[i].sharedWith == _user) {
                return (true, accesses[i].encryptedKey);
            }
        }
        
        return (false, "");
    }
    
    function getTotalFiles() external view returns (uint256) {
        return fileCounter;
    }
}