package com.metrolink.model;

import java.time.LocalDateTime;

public class User {
    private int           id;
    private String        username;
    private String        password;   // stored as bcrypt hash
    private String        fullName;
    private String        role;       // ADMIN | STAFF
    private boolean       isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public User() {}

    // Getters & Setters
    public int getId()                       { return id; }
    public void setId(int id)                { this.id = id; }

    public String getUsername()              { return username; }
    public void setUsername(String v)        { this.username = v; }

    public String getPassword()              { return password; }
    public void setPassword(String v)        { this.password = v; }

    public String getFullName()              { return fullName; }
    public void setFullName(String v)        { this.fullName = v; }

    public String getRole()                  { return role; }
    public void setRole(String v)            { this.role = v; }

    public boolean isActive()                { return isActive; }
    public void setActive(boolean v)         { this.isActive = v; }

    public LocalDateTime getCreatedAt()      { return createdAt; }
    public void setCreatedAt(LocalDateTime v){ this.createdAt = v; }

    public LocalDateTime getUpdatedAt()      { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v){ this.updatedAt = v; }
}
