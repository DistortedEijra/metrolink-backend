package com.metrolink.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class User {
    private int           id;
    private String        username;
    private String        password;   // bcrypt hash
    private String        fullName;
    private LocalDate     birthdate;
    private String        address;
    private String        email;
    private LocalDate     hireDate;
    private String        role;       // ADMIN | STAFF
    private boolean       isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public User() {}

    public int getId()                        { return id; }
    public void setId(int id)                 { this.id = id; }

    public String getUsername()               { return username; }
    public void setUsername(String v)         { this.username = v; }

    public String getPassword()               { return password; }
    public void setPassword(String v)         { this.password = v; }

    public String getFullName()               { return fullName; }
    public void setFullName(String v)         { this.fullName = v; }

    public LocalDate getBirthdate()           { return birthdate; }
    public void setBirthdate(LocalDate v)     { this.birthdate = v; }

    public String getAddress()                { return address; }
    public void setAddress(String v)          { this.address = v; }

    public String getEmail()                  { return email; }
    public void setEmail(String v)            { this.email = v; }

    public LocalDate getHireDate()            { return hireDate; }
    public void setHireDate(LocalDate v)      { this.hireDate = v; }

    public String getRole()                   { return role; }
    public void setRole(String v)             { this.role = v; }

    public boolean isActive()                 { return isActive; }
    public void setActive(boolean v)          { this.isActive = v; }

    public LocalDateTime getCreatedAt()       { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }

    public LocalDateTime getUpdatedAt()       { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
}
